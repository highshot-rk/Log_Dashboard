import os
from datetime import datetime, timezone

import psycopg
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "postgresql://logsuser:logspass@localhost:5432/logsdb")

from app.main import app


def _database_url() -> str:
    return os.environ.get("DATABASE_URL", "postgresql://logsuser:logspass@localhost:5432/logsdb")


def _ensure_table_exists() -> None:
    with psycopg.connect(_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS logs (
                    id BIGSERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ NOT NULL,
                    severity VARCHAR(16) NOT NULL,
                    source VARCHAR(128) NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
        conn.commit()


def _clear_logs() -> None:
    with psycopg.connect(_database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM logs")
        conn.commit()


def test_create_and_query_raw_logs() -> None:
    _ensure_table_exists()
    _clear_logs()
    client = TestClient(app)

    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "severity": "ERROR",
        "source": "integration-test",
        "message": "integration test log",
    }
    create_response = client.post("/api/v1/logs", json=payload)
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["severity"] == "ERROR"

    raw_response = client.get("/api/v1/logs/query/raw?page=1&size=10")
    assert raw_response.status_code == 200
    raw_data = raw_response.json()
    assert raw_data["total"] >= 1


def test_aggregate_endpoint_returns_totals() -> None:
    _ensure_table_exists()
    client = TestClient(app)
    response = client.get("/api/v1/logs/query/aggregate?group_by=day")
    assert response.status_code == 200
    data = response.json()
    assert "series" in data
    assert "totals" in data
    assert "all" in data["totals"]
