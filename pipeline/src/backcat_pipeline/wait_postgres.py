"""Wait for Postgres to accept queries, then return. Used by the worker entrypoint.

`depends_on: service_healthy` is not sufficient on its own: after a host reboot
Docker restarts everything at once, and Postgres answers its healthcheck while
still finishing recovery. `migrate` then gets exactly one attempt and dies on
"the database system is starting up", taking the worker with it — the whole
pipeline sat idle for two days on exactly that. Mirrors wait_neo4j.
"""

import sys
import time

from .db import connect


def main() -> None:
    last: Exception | None = None
    for i in range(30):
        try:
            with connect() as conn:
                conn.execute("SELECT 1")
            print("postgres ready")
            return
        except Exception as e:  # noqa: BLE001 — retry any connect/startup flake
            last = e
            print(f"postgres not ready ({type(e).__name__}), retry {i + 1}/30", flush=True)
            time.sleep(2)
    print(f"postgres never became ready: {last}", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
