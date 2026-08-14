"""Wait for Neo4j Bolt, then apply graph constraints. Used by the worker entrypoint."""

import time
import sys


def main() -> None:
    from backcat_pipeline.graph import ensure_constraints

    last: Exception | None = None
    for i in range(30):
        try:
            ensure_constraints()
            print("neo4j constraints ready")
            return
        except Exception as e:  # noqa: BLE001 — retry any connect/auth flake
            last = e
            print(f"neo4j not ready ({type(e).__name__}), retry {i + 1}/30", flush=True)
            time.sleep(2)
    print(f"neo4j never became ready: {last}", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
