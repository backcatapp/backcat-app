"""Cost logging (mandatory on every paid call) and the spend guard."""

from .config import get_config


class SpendBlocked(RuntimeError):
    pass


def log_cost(
    conn,
    *,
    catalog_id: str,
    episode_id: str | None,
    service: str,
    model: str,
    units: float,
    unit_kind: str,
    cost_usd: float,
) -> None:
    conn.execute(
        """
        INSERT INTO cost_events (catalog_id, episode_id, service, model, units, unit_kind, cost_usd)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (catalog_id, episode_id, service, model, units, unit_kind, cost_usd),
    )


def spend_today(conn) -> float:
    row = conn.execute(
        "SELECT coalesce(sum(cost_usd), 0) FROM cost_events WHERE created_at::date = current_date"
    ).fetchone()
    return float(row[0])


def ensure_spend_allowed(conn, estimated_next_usd: float) -> None:
    if get_config(conn, "kill_switch"):
        raise SpendBlocked("kill_switch is on (app_config) — all paid calls are blocked")
    limit = float(get_config(conn, "daily_spend_limit_usd"))
    spent = spend_today(conn)
    if spent + estimated_next_usd > limit:
        raise SpendBlocked(
            f"daily spend limit would be exceeded: spent ${spent:.2f} + est ${estimated_next_usd:.2f} > ${limit:.2f}"
        )
