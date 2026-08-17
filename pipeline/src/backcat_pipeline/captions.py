"""YouTube caption ingest — preferred over downloading audio.

Fan-requested channels have no owner OAuth, so we pull the public timedtext
track the player already shows (manual first, then auto-generated). Snippets
are phrase-level; words are interpolated across each cue so chunking still
sees (w, start, end). Timestamps are coarser than Whisper; no captions → the
caller falls back to yt-dlp audio.

The timedtext fetch is the same datacenter-IP fight as audio. YT_DLP_PROXY is
reused when set. A 429/bot-wall here means the proxy is still a hosting ASN,
not that captions are missing.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from . import joblog
from .download import AUDIO_DIR

CAPTIONS_DIR = AUDIO_DIR.parent / "captions"


def captions_path(episode_id: str) -> Path:
    return CAPTIONS_DIR / f"{episode_id}.json"


def _langs() -> list[str]:
    raw = os.environ.get("YT_CAPTION_LANGS", "fa,en")
    return [p.strip() for p in raw.split(",") if p.strip()] or ["en"]


def _proxy_config():
    raw = (os.environ.get("YT_DLP_PROXY") or "").strip()
    if not raw:
        return None
    from youtube_transcript_api.proxies import GenericProxyConfig

    return GenericProxyConfig(http_url=raw, https_url=raw)


def snippets_to_words(snippets: list[dict]) -> tuple[list[dict], str, float]:
    """Cue list → Whisper-shaped words, full text, duration_s."""
    words: list[dict] = []
    texts: list[str] = []
    end = 0.0
    for snip in snippets:
        text = " ".join((snip.get("text") or "").replace("\n", " ").split())
        if not text:
            continue
        texts.append(text)
        tokens = text.split()
        start = float(snip.get("start") or 0.0)
        dur = float(snip.get("duration") or 0.0) or max(0.04 * len(tokens), 0.04)
        end = max(end, start + dur)
        step = dur / len(tokens)
        for i, tok in enumerate(tokens):
            s = start + i * step
            words.append({"w": tok, "s": round(s, 3), "e": round(s + step, 3)})
    return words, " ".join(texts), end


def fetch_youtube_captions(video_id: str) -> dict | None:
    """Return {language, generated, snippets} or None if unavailable / blocked."""
    from youtube_transcript_api import YouTubeTranscriptApi

    langs = _langs()
    api = YouTubeTranscriptApi(proxy_config=_proxy_config())
    try:
        listing = api.list(video_id)
    except Exception as exc:  # noqa: BLE001 — any block/parse error is a miss
        joblog.log(f"caption list failed: {type(exc).__name__}: {exc}")
        return None

    track = None
    for finder in (
        lambda: listing.find_manually_created_transcript(langs),
        lambda: listing.find_generated_transcript(langs),
        lambda: listing.find_transcript(langs),
    ):
        try:
            track = finder()
            break
        except Exception:
            continue
    if track is None:
        joblog.log(f"no caption track in {langs}")
        return None

    try:
        fetched = track.fetch()
    except Exception as exc:  # noqa: BLE001
        joblog.log(f"caption fetch failed: {type(exc).__name__}: {exc}")
        return None

    snippets = []
    for item in fetched:
        text = getattr(item, "text", None)
        start = getattr(item, "start", None)
        duration = getattr(item, "duration", None)
        if text is None and isinstance(item, dict):
            text, start, duration = item.get("text"), item.get("start"), item.get("duration")
        snippets.append({"text": text or "", "start": float(start or 0), "duration": float(duration or 0)})

    if not any(s["text"].strip() for s in snippets):
        joblog.log("caption track was empty")
        return None

    return {
        "language": getattr(track, "language_code", None) or langs[0],
        "generated": bool(getattr(track, "is_generated", True)),
        "snippets": snippets,
    }


def save_captions(episode_id: str, payload: dict) -> Path:
    dest = captions_path(episode_id)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return dest
