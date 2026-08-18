"""YouTube channel connector (creator self-serve, pre-OAuth).

Channel metadata comes from YouTube's public channel RSS
(youtube.com/feeds/videos.xml?channel_id=...) — no API key, but only the
~15 most recent videos. Ingest prefers public captions (timedtext); yt-dlp
audio is the fallback when YT_INGEST=auto and no track exists.
"""

import os
import re
import shutil
import subprocess
from pathlib import Path

import feedparser
import httpx

from .download import audio_path
from .ids import det_id

FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={cid}"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def resolve_channel_id(url_or_handle: str) -> str:
    """Accepts UC... id, @handle, or any youtube.com channel/video URL."""
    s = url_or_handle.strip()
    if re.fullmatch(r"UC[\w-]{22}", s):
        return s
    if not s.startswith("http"):
        s = "https://www.youtube.com/" + (s if s.startswith("@") else "@" + s)
    resp = httpx.get(s, headers=_UA, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    m = re.search(r'"channelId":"(UC[\w-]{22})"', resp.text) or re.search(
        r"channel_id=(UC[\w-]{22})", resp.text
    )
    if not m:
        raise ValueError(f"could not find a channel id at {url_or_handle}")
    return m.group(1)


def add_channel(conn, url_or_handle: str) -> tuple[str, str, int]:
    """Upsert catalog + episodes from the channel RSS. Queues NO jobs —
    transcription is selected per episode. Returns (catalog_id, name, n)."""
    cid = resolve_channel_id(url_or_handle)
    feed = feedparser.parse(FEED_URL.format(cid=cid))
    if not feed.entries and feed.bozo:
        raise ValueError(f"could not read channel feed for {cid}")
    name = feed.feed.get("title", cid)
    catalog_id = det_id("yt:" + cid)
    conn.execute(
        """
        INSERT INTO catalogs (id, name, rss_url) VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """,
        (catalog_id, name, FEED_URL.format(cid=cid)),
    )
    count = 0
    for entry in feed.entries:
        vid = entry.get("yt_videoid")
        if not vid:
            continue
        from datetime import datetime, timezone

        published = None
        if entry.get("published_parsed"):
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        conn.execute(
            """
            INSERT INTO episodes (id, catalog_id, guid, title, audio_url, published_at, source_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
            """,
            (det_id(catalog_id, vid), catalog_id, vid, entry.get("title", vid),
             f"youtube:{vid}", published, entry.get("link")),
        )
        count += 1
    conn.commit()
    return catalog_id, name, count


def _yt_dlp() -> str:
    found = shutil.which("yt-dlp") or os.environ.get("YT_DLP_EXE")
    if not found:
        shim = Path.home() / "AppData/Local/Microsoft/WinGet/Links/yt-dlp.exe"
        pkg = (
            Path.home()
            / "AppData/Local/Microsoft/WinGet/Packages/yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe/yt-dlp.exe"
        )
        found = str(shim) if shim.exists() else (str(pkg) if pkg.exists() else None)
    if not found:
        raise RuntimeError("yt-dlp is not installed (winget install yt-dlp) — needed for YouTube audio")
    return found


_COOKIE_CANDIDATES = ("yt-dlp/cookies.txt", "data/youtube-cookies.txt")


def cookie_file() -> Path | None:
    """Netscape cookie jar for YouTube, if one has been provisioned.

    Datacenter IPs hit YouTube's "confirm you're not a bot" wall; a PO token
    can't lift an existing block, so an authenticated cookie jar is the only
    unattended way through. Mounted read-write on purpose: YouTube rotates
    session cookies and yt-dlp persists them back, which keeps the jar alive
    far longer than a frozen copy.
    """
    explicit = os.environ.get("YT_DLP_COOKIES")
    paths = [Path(explicit)] if explicit else [Path(c) for c in _COOKIE_CANDIDATES]
    return next((p for p in paths if p.is_file() and p.stat().st_size > 0), None)


def ingest_youtube(episode_id: str, video_id: str) -> str:
    """Captions first (tiny timedtext); yt-dlp audio only if that misses.

    YT_INGEST=captions|audio|auto (default auto).
    """
    mode = (os.environ.get("YT_INGEST") or "auto").strip().lower()
    if mode not in ("captions", "audio", "auto"):
        mode = "auto"

    if mode != "audio":
        from .captions import fetch_youtube_captions, save_captions

        payload = fetch_youtube_captions(video_id)
        if payload:
            dest = save_captions(episode_id, payload)
            kind = "auto" if payload.get("generated") else "manual"
            n = len(payload["snippets"])
            from . import joblog

            joblog.log(f"captions {payload.get('language')} ({kind}, {n} cues) → {dest.name}")
            return f"(captions {payload.get('language')} {kind}, {n} cues)"
        if mode == "captions":
            raise RuntimeError(
                "no YouTube captions (disabled, not generated yet, or timedtext blocked). "
                "Set YT_INGEST=audio to fall back to yt-dlp, or fix YT_DLP_PROXY (rotating residential)."
            )
        from . import joblog

        joblog.log("no captions — falling back to yt-dlp audio")

    path = download_youtube(episode_id, video_id)
    return f"({path.stat().st_size >> 20}MB audio)"


def download_youtube(episode_id: str, video_id: str) -> Path:
    dest = audio_path(episode_id)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        _yt_dlp(),
        "-f", "bestaudio[ext=m4a]/bestaudio/best",
        "-o", str(dest),
        "--no-progress",
    ]
    cookies = cookie_file()
    if cookies:
        cmd.extend(["--cookies", str(cookies)])
        # The default client set includes ios, which ignores a cookie jar
        # entirely — pinning cookie-honouring clients is what makes auth count.
        client = os.environ.get("YT_DLP_PLAYER_CLIENT", "web,mweb,android")
        cmd.extend(["--extractor-args", f"youtube:player_client={client}"])
    proxy = os.environ.get("YT_DLP_PROXY")
    if proxy:
        cmd.extend(["--proxy", proxy])
    cmd.append(f"https://www.youtube.com/watch?v={video_id}")
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        hint = "" if cookies else " (no cookie jar — see infra/yt-dlp/README.md)"
        raise RuntimeError(f"yt-dlp failed ({exc.returncode}){hint}: {detail[-1500:]}") from exc
    if not dest.exists() or dest.stat().st_size == 0:
        raise RuntimeError("yt-dlp exited 0 but wrote no audio")
    return dest
