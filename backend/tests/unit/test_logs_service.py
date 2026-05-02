from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.services.logs_service import build_log_filters, validate_severity


def test_validate_severity_accepts_known_value() -> None:
    assert validate_severity("error") == "ERROR"


def test_validate_severity_rejects_unknown_value() -> None:
    with pytest.raises(HTTPException):
        validate_severity("fatal")


def test_build_log_filters_includes_expected_clauses() -> None:
    where_clause, params = build_log_filters(
        severity="info",
        source="api",
        search="timeout",
        from_ts=datetime(2026, 1, 1, tzinfo=timezone.utc),
        to_ts=datetime(2026, 1, 31, tzinfo=timezone.utc),
    )

    assert "severity = %s" in where_clause
    assert "source = %s" in where_clause
    assert "(message ILIKE %s OR source ILIKE %s)" in where_clause
    assert "timestamp >= %s" in where_clause
    assert "timestamp <= %s" in where_clause
    assert params[0] == "INFO"
