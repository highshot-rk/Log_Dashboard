import os
from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg import Connection


def get_database_url() -> str | None:
    return os.environ.get("DATABASE_URL")


@contextmanager
def get_connection() -> Generator[Connection, None, None]:
    url = get_database_url()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    conn = psycopg.connect(url)
    try:
        yield conn
    finally:
        conn.close()


def ping_database() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
