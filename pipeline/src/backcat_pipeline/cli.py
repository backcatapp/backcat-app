"""Ingest CLI: add / add-local / run / retry / status."""

import shutil
import time
from pathlib import Path

import typer

from .chunking import chunk_episode
from .config import get_config
from .costs import SpendBlocked
from .db import connect
from .download import audio_path, download_episode
from .embed import embed_episode
from .ids import det_id
from .rss import STAGES, add_catalog
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


@app.command(name="add-local")
def add_local(
    audio_file: Path,
    catalog: str = typer.Option(..., "--catalog", help="Catalog name to file this under"),
    title: str = typer.Option(None, "--title", help="Episode title (default: file name)"),
) -> None:
    """Add a local audio file as an episode (e.g. a yt-dlp pull of your own video).

    The file is copied into the audio store and the download stage is marked done;
    transcribe/chunk/embed run as usual via `ingest run`.
    """
    if not audio_file.exists():
        raise typer.BadParameter(f"{audio_file} does not exist")
    with connect() as conn:
        catalog_id = det_id("local:" + catalog)
        conn.execute(
            """
            INSERT INTO catalogs (id, name, rss_url) VALUES (%s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (catalog_id, catalog, "local:" + catalog),
        )
        episode_id = det_id(catalog_id, audio_file.name)
        conn.execute(
            """
            INSERT INTO episodes (id, catalog_id, guid, title, audio_url)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
            """,
            (episode_id, catalog_id, audio_file.name, title or audio_file.stem, "file:" + str(audio_file)),
        )
        for stage in STAGES:
            conn.execute(
                """
                INSERT INTO jobs (id, catalog_id, episode_id, stage) VALUES (%s, %s, %s, %s)
                ON CONFLICT (episode_id, stage) DO NOTHING
                """,
                (det_id(episode_id, stage), catalog_id, episode_id, stage),
            )
        dest = audio_path(episode_id)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(audio_file, dest)
        conn.execute(
            "UPDATE jobs SET status = 'done', started_at = now(), finished_at = now() "
            "WHERE episode_id = %s AND stage = 'download'",
            (episode_id,),
        )
        conn.commit()
    typer.echo(f"episode {episode_id} added to catalog '{catalog}' — now: ingest run \"{catalog}\"")


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


def _resolve_catalog(conn, catalog: str) -> str:
    row = conn.execute(
        "SELECT id FROM catalogs WHERE id = %s OR name = %s", (catalog, catalog)
    ).fetchone()
    if row is None:
        raise typer.BadParameter(f"no catalog '{catalog}'")
    return row[0]


def _ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


@app.command()
def search(catalog: str, query: str, k: int = typer.Option(6, "--k")) -> None:
    """Hybrid retrieval (dense + keyword + RRF) — cited chunks in the terminal."""
    from .retrieval import hybrid_search

    with connect() as conn:
        catalog_id = _resolve_catalog(conn, catalog)
        hits = hybrid_search(conn, catalog_id, query, k=k)
        conn.commit()  # persist the query-embedding cost event
    if not hits:
        typer.echo("no results — catalog may not cover this (honest absence)")
        return
    for i, h in enumerate(hits, 1):
        typer.echo(
            f"{i}. [{h.episode_title} · {_ts(h.start_s)}–{_ts(h.end_s)}] "
            f"score={h.score:.4f} via {'+'.join(h.channels)}"
        )
        typer.echo(f"   {h.text[:200]}{'…' if len(h.text) > 200 else ''}")


@app.command()
def ask(catalog: str, query: str, k: int = typer.Option(6, "--k")) -> None:
    """Grounded, cited answer streamed to the terminal (Claude, grounded-only)."""
    from .answering import _ts, ask_stream

    with connect() as conn:
        catalog_id = _resolve_catalog(conn, catalog)
        gen = ask_stream(conn, catalog_id=catalog_id, query=query, k=k)
        hits = None
        try:
            while True:
                typer.echo(next(gen), nl=False)
        except StopIteration as done:
            hits, _usage = done.value
        conn.commit()
    typer.echo("")
    if not hits:
        typer.echo("not covered by this catalog (honest absence) — question should be logged")
        return
    typer.echo("\nsources:")
    for i, h in enumerate(hits, 1):
        typer.echo(f"  [{i}] {h.episode_title} · {_ts(h.start_s)}–{_ts(h.end_s)}")


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
