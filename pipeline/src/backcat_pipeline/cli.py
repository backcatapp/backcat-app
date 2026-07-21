"""Ingest CLI. Day 4: add / run / status. Stages beyond transcribe arrive day 5+."""

import time

import typer

from .chunking import chunk_episode
from .config import get_config
from .costs import SpendBlocked
from .db import connect
from .download import audio_path, download_episode
from .embed import embed_episode
from .rss import add_catalog
from .transcribe import transcribe_episode

app = typer.Typer(no_args_is_help=True, add_completion=False)


@app.command()
def add(
    rss_url: str,
    limit: int = typer.Option(None, "--limit", help="Only queue the N most recent episodes"),
) -> None:
    """Parse an RSS feed, upsert catalog + episodes, queue pipeline jobs."""
    with connect() as conn:
        catalog_id, n, queued = add_catalog(conn, rss_url, limit=limit)
    typer.echo(f"catalog {catalog_id}: {n} episodes upserted, {queued} queued for processing")


def _claim_jobs(conn, catalog: str, stage: str, episode: str | None) -> list[tuple]:
    return conn.execute(
        """
        SELECT j.id, j.episode_id, e.audio_url
        FROM jobs j
        JOIN episodes e ON e.id = j.episode_id
        JOIN catalogs c ON c.id = j.catalog_id
        WHERE (c.id = %s OR c.name = %s) AND c.paused = FALSE
          AND j.stage = %s AND j.status = 'queued'
          AND (%s::text IS NULL OR j.episode_id = %s)
        ORDER BY e.published_at NULLS LAST
        """,
        (catalog, catalog, stage, episode, episode),
    ).fetchall()


def _run_stage(catalog: str, stage: str, worker, episode: str | None = None) -> None:
    with connect() as conn:
        max_attempts = int(get_config(conn, "max_job_attempts"))
        jobs = _claim_jobs(conn, catalog, stage, episode)
        typer.echo(f"{stage}: {len(jobs)} queued")
        for job_id, episode_id, audio_url in jobs:
            conn.execute(
                "UPDATE jobs SET status = 'running', attempt_count = attempt_count + 1, "
                "started_at = now(), error = NULL WHERE id = %s",
                (job_id,),
            )
            conn.commit()
            t0 = time.monotonic()
            try:
                detail = worker(conn, episode_id, audio_url)
                conn.execute(
                    "UPDATE jobs SET status = 'done', finished_at = now() WHERE id = %s", (job_id,)
                )
                conn.commit()
                typer.echo(f"  done {episode_id} in {time.monotonic() - t0:.1f}s {detail}")
            except SpendBlocked as exc:
                conn.rollback()
                conn.execute(
                    "UPDATE jobs SET status = 'queued', error = %s WHERE id = %s", (str(exc), job_id)
                )
                conn.commit()
                typer.echo(f"  STOPPED: {exc}")
                raise typer.Exit(code=2)
            except Exception as exc:  # noqa: BLE001 — job boundary: record, don't crash the batch
                conn.rollback()
                attempts = conn.execute(
                    "SELECT attempt_count FROM jobs WHERE id = %s", (job_id,)
                ).fetchone()[0]
                status = "failed" if attempts >= max_attempts else "queued"
                conn.execute(
                    "UPDATE jobs SET status = %s, error = %s, finished_at = now() WHERE id = %s",
                    (status, str(exc)[:2000], job_id),
                )
                conn.commit()
                typer.echo(f"  {status} {episode_id} (attempt {attempts}): {exc}")


def _catalog_of(conn, episode_id: str) -> str:
    return conn.execute("SELECT catalog_id FROM episodes WHERE id = %s", (episode_id,)).fetchone()[0]


@app.command()
def run(
    catalog: str,
    episode: str = typer.Option(None, "--episode", help="Process only this episode id"),
) -> None:
    """Work through queued jobs for a catalog (by id or name), stage by stage."""

    def _download(conn, episode_id: str, audio_url: str) -> str:
        path = download_episode(episode_id, audio_url)
        return f"({path.stat().st_size >> 20}MB)"

    def _transcribe(conn, episode_id: str, audio_url: str) -> str:
        hours = transcribe_episode(
            conn, catalog_id=_catalog_of(conn, episode_id), episode_id=episode_id,
            path=audio_path(episode_id),
        )
        return f"({hours:.2f}h audio)"

    def _chunk(conn, episode_id: str, audio_url: str) -> str:
        n = chunk_episode(conn, catalog_id=_catalog_of(conn, episode_id), episode_id=episode_id)
        return f"({n} chunks)"

    def _embed(conn, episode_id: str, audio_url: str) -> str:
        n, tokens = embed_episode(
            conn, catalog_id=_catalog_of(conn, episode_id), episode_id=episode_id
        )
        return f"({n} chunks, {tokens} tokens)"

    _run_stage(catalog, "download", _download, episode)
    _run_stage(catalog, "transcribe", _transcribe, episode)
    _run_stage(catalog, "chunk", _chunk, episode)
    _run_stage(catalog, "embed", _embed, episode)


@app.command()
def retry(catalog: str) -> None:
    """Reset failed jobs to queued (the panel's retry button does the same row update)."""
    with connect() as conn:
        n = conn.execute(
            """
            UPDATE jobs SET status = 'queued', attempt_count = 0, error = NULL
            WHERE status = 'failed'
              AND catalog_id IN (SELECT id FROM catalogs WHERE id = %s OR name = %s)
            """,
            (catalog, catalog),
        ).rowcount
        conn.commit()
    typer.echo(f"requeued {n} failed jobs")


@app.command()
def status() -> None:
    """Job counts per catalog and stage — the terminal view of the status page."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT c.name, j.stage, j.status, count(*)
            FROM jobs j JOIN catalogs c ON c.id = j.catalog_id
            GROUP BY c.name, j.stage, j.status ORDER BY c.name, j.stage, j.status
            """
        ).fetchall()
        costs = conn.execute(
            "SELECT coalesce(sum(cost_usd), 0), coalesce(sum(units), 0) FROM cost_events "
            "WHERE unit_kind = 'audio_hours'"
        ).fetchone()
    if not rows:
        typer.echo("no jobs yet — run `ingest add <rss_url>` first")
        return
    for name, stage, job_status, count in rows:
        typer.echo(f"{name:30.30s} {stage:12s} {job_status:8s} {count:5d}")
    typer.echo(f"total transcribed: {costs[1]:.2f}h · total spend: ${costs[0]:.4f}")
