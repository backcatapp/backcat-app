"""Apply migrations/*.sql in filename order, tracked in schema_migrations. Idempotent."""

import sys
from pathlib import Path

from .db import connect

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


def main() -> None:
    with connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )
        applied = {r[0] for r in conn.execute("SELECT name FROM schema_migrations").fetchall()}
        pending = [p for p in sorted(MIGRATIONS_DIR.glob("*.sql")) if p.name not in applied]
        if not pending:
            print("migrate: up to date")
            return
        for path in pending:
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,))
            conn.commit()
            print(f"migrate: applied {path.name}")


if __name__ == "__main__":
    sys.exit(main())
