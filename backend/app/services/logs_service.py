from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException

SEVERITY_VALUES = {"DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"}


def validate_severity(value: str) -> str:
    normalized = value.upper()
    if normalized not in SEVERITY_VALUES:
        raise HTTPException(status_code=400, detail="Invalid severity value")
    return normalized


def build_log_filters(
    severity: str | None,
    source: str | None,
    search: str | None,
    from_ts: datetime | None,
    to_ts: datetime | None,
) -> tuple[str, list[Any]]:
    filters = []
    params: list[Any] = []

    if severity:
        filters.append("severity = %s")
        params.append(validate_severity(severity))
    if source:
        filters.append("source = %s")
        params.append(source)
    if search:
        filters.append("(message ILIKE %s OR source ILIKE %s)")
        like_value = f"%{search}%"
        params.extend([like_value, like_value])
    if from_ts:
        filters.append("timestamp >= %s")
        params.append(from_ts)
    if to_ts:
        filters.append("timestamp <= %s")
        params.append(to_ts)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    return where_clause, params
