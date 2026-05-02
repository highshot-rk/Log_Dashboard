import csv
import io
import logging
import time
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from psycopg.rows import dict_row

from app.db import get_connection, get_database_url, ping_database
from app.services.logs_service import build_log_filters, validate_severity

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("logs_dashboard_api")

app = FastAPI(title="Logs Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.exception("request_failed method=%s path=%s duration_ms=%.2f", request.method, request.url.path, elapsed_ms)
        raise
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "request_complete method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled_exception path=%s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

class LogBase(BaseModel):
    timestamp: datetime
    severity: str = Field(min_length=4, max_length=16)
    source: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1)


class LogCreate(LogBase):
    pass


class LogUpdate(BaseModel):
    timestamp: datetime | None = None
    severity: str | None = Field(default=None, min_length=4, max_length=16)
    source: str | None = Field(default=None, min_length=1, max_length=128)
    message: str | None = Field(default=None, min_length=1)

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_database():
    if not get_database_url():
        return JSONResponse(
            status_code=503,
            content={
                "status": "unconfigured",
                "detail": "DATABASE_URL is not set",
            },
        )
    try:
        ping_database()
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "detail": str(exc)},
        )


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Hello from Logs Dashboard backend"}


@app.get("/hello")
def hello_world() -> dict[str, str]:
    return {"message": "Hello World from FastAPI"}


@app.post("/api/v1/logs")
def create_log(payload: LogCreate):
    severity = validate_severity(payload.severity)
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO logs (timestamp, severity, source, message)
                VALUES (%s, %s, %s, %s)
                RETURNING id, timestamp, severity, source, message, created_at, updated_at
                """,
                (payload.timestamp, severity, payload.source, payload.message),
            )
            row = cur.fetchone()
        conn.commit()
    return row


@app.get("/api/v1/logs")
def list_logs(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    severity: str | None = None,
    source: str | None = None,
    search: str | None = None,
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
    sort_by: str = "timestamp",
    sort_order: str = "desc",
):
    allowed_sort_columns = {"timestamp", "severity", "source", "created_at"}
    if sort_by not in allowed_sort_columns:
        raise HTTPException(status_code=400, detail="Invalid sort_by value")
    if sort_order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid sort_order value")

    where_clause, params = build_log_filters(severity, source, search, from_ts, to_ts)
    offset = (page - 1) * size

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"SELECT COUNT(*) AS total FROM logs {where_clause}", params)
            total = cur.fetchone()["total"]

            list_sql = f"""
                SELECT id, timestamp, severity, source, message, created_at, updated_at
                FROM logs
                {where_clause}
                ORDER BY {sort_by} {sort_order}
                LIMIT %s OFFSET %s
            """
            cur.execute(list_sql, [*params, size, offset])
            rows = cur.fetchall()

    return {"items": rows, "page": page, "size": size, "total": total}


@app.get("/api/v1/logs/query/raw")
def query_raw_logs(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    severity: str | None = None,
    source: str | None = None,
    search: str | None = None,
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
    sort_by: str = "timestamp",
    sort_order: str = "desc",
):
    return list_logs(
        page=page,
        size=size,
        severity=severity,
        source=source,
        search=search,
        from_ts=from_ts,
        to_ts=to_ts,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@app.get("/api/v1/logs/export/csv")
def export_logs_csv(
    severity: str | None = None,
    source: str | None = None,
    search: str | None = None,
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
    sort_by: str = "timestamp",
    sort_order: str = "desc",
):
    allowed_sort_columns = {"timestamp", "severity", "source", "created_at"}
    if sort_by not in allowed_sort_columns:
        raise HTTPException(status_code=400, detail="Invalid sort_by value")
    if sort_order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid sort_order value")

    where_clause, params = build_log_filters(severity, source, search, from_ts, to_ts)
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT id, timestamp, severity, source, message, created_at, updated_at
                FROM logs
                {where_clause}
                ORDER BY {sort_by} {sort_order}
                """,
                params,
            )
            rows = cur.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "timestamp", "severity", "source", "message", "created_at", "updated_at"])
    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["timestamp"],
                row["severity"],
                row["source"],
                row["message"],
                row["created_at"],
                row["updated_at"],
            ]
        )
    content = output.getvalue()
    output.close()

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="logs_export.csv"'},
    )


@app.get("/api/v1/logs/{log_id}")
def get_log(log_id: int):
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id, timestamp, severity, source, message, created_at, updated_at
                FROM logs
                WHERE id = %s
                """,
                (log_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Log not found")
    return row


@app.put("/api/v1/logs/{log_id}")
def update_log(log_id: int, payload: LogUpdate):
    updates: list[str] = []
    values: list[object] = []

    if payload.timestamp is not None:
        updates.append("timestamp = %s")
        values.append(payload.timestamp)
    if payload.severity is not None:
        updates.append("severity = %s")
        values.append(validate_severity(payload.severity))
    if payload.source is not None:
        updates.append("source = %s")
        values.append(payload.source)
    if payload.message is not None:
        updates.append("message = %s")
        values.append(payload.message)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    updates.append("updated_at = %s")
    values.append(datetime.now(timezone.utc))
    values.append(log_id)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                UPDATE logs
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING id, timestamp, severity, source, message, created_at, updated_at
                """,
                values,
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Log not found")
    return row


@app.delete("/api/v1/logs/{log_id}")
def delete_log(log_id: int):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM logs WHERE id = %s", (log_id,))
            deleted = cur.rowcount
        conn.commit()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"status": "deleted", "id": log_id}


@app.get("/api/v1/logs/query/aggregate")
def aggregate_logs(
    group_by: str = "day",
    severity: str | None = None,
    source: str | None = None,
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
):
    group_map = {"hour": "hour", "day": "day", "week": "week"}
    if group_by not in group_map:
        raise HTTPException(status_code=400, detail="Invalid group_by value")

    where_clause, params = build_log_filters(severity, source, None, from_ts, to_ts)
    truncate_unit = group_map[group_by]

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT
                    DATE_TRUNC('{truncate_unit}', timestamp) AS bucket,
                    COUNT(*) AS count
                FROM logs
                {where_clause}
                GROUP BY bucket
                ORDER BY bucket ASC
                """,
                params,
            )
            series = cur.fetchall()

            cur.execute(f"SELECT COUNT(*) AS all_count FROM logs {where_clause}", params)
            total_count = cur.fetchone()["all_count"]

            cur.execute(
                f"""
                SELECT severity, COUNT(*) AS count
                FROM logs
                {where_clause}
                GROUP BY severity
                ORDER BY severity ASC
                """,
                params,
            )
            by_severity_rows = cur.fetchall()

    by_severity = {item["severity"]: item["count"] for item in by_severity_rows}
    return {"series": series, "totals": {"all": total_count, "by_severity": by_severity}}
