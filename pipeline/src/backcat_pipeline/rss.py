"""RSS -> catalogs/episodes/jobs. Idempotent: GUID dedupe, deterministic IDs, upserts only."""

from datetime import datetime, timezone

import feedparser

from .ids import det_id

STAGES = ("download", "transcribe", "chunk", "embed")


def add_catalog(conn, rss_url: str) -> tuple[str, int]:
    """Parse the feed, upsert catalog + episodes, queue day-4 jobs. Returns (catalog_id, n_episodes)."""
    feed = feedparser.parse(rss_url)
    if feed.bozo and not feed.entries:
        raise ValueError(f"could not parse feed: {feed.bozo_exception}")

    catalog_id = det_id(rss_url)
    name = feed.feed.get("title", rss_url)
    conn.execute(
        """
        INSERT INTO catalogs (id, name, rss_url) VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """,
        (catalog_id, name, rss_url),
    )

    count = 0
    for entry in feed.entries:
        guid = entry.get("id") or entry.get("link")
        enclosures = [e for e in entry.get("enclosures", []) if "audio" in e.get("type", "")]
        if not guid or not enclosures:
            continue
        episode_id = det_id(catalog_id, guid)
        published = None
        if entry.get("published_parsed"):
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        conn.execute(
            """
            INSERT INTO episodes (id, catalog_id, guid, title, audio_url, published_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, audio_url = EXCLUDED.audio_url
            """,
            (episode_id, catalog_id, guid, entry.get("title", guid), enclosures[0]["href"], published),
        )
        for stage in STAGES:
            conn.execute(
                """
                INSERT INTO jobs (id, catalog_id, episode_id, stage)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (episode_id, stage) DO NOTHING
                """,
                (det_id(episode_id, stage), catalog_id, episode_id, stage),
            )
        count += 1
    conn.commit()
    return catalog_id, count
