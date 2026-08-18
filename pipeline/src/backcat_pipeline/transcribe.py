"""Whisper transcription on Groq with word timestamps.

Files over the API size cap are split into ~10-minute segments with ffmpeg and the
word timestamps offset-merged back to episode time. Small files skip ffmpeg entirely.
Cost = response audio duration x configured $/audio-hour, logged before commit.
"""

import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path

from . import joblog

import httpx

from .config import get_config, settings
from .costs import ensure_spend_allowed, log_cost

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
MAX_UPLOAD_BYTES = 24 * 1024 * 1024  # stay under Groq's 25MB free-tier cap
SEGMENT_SECONDS = 600


def _sniff_ext(path: Path) -> str:
    """Groq validates by filename extension; our files are stored as <id>.audio."""
    head = path.open("rb").read(12)
    if head.startswith(b"RIFF"):
        return ".wav"
    if head.startswith(b"OggS"):
        return ".ogg"
    if head.startswith(b"fLaC"):
        return ".flac"
    if head[4:8] == b"ftyp":
        return ".m4a"
    return ".mp3"  # ID3 tag or raw MPEG frames


def _groq_transcribe(path: Path, model: str) -> dict:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set — add it to pipeline/.env")
    with open(path, "rb") as f:
        resp = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            files={"file": (f"audio{_sniff_ext(path)}", f, "application/octet-stream")},
            data={
                "model": model,
                "response_format": "verbose_json",
                "timestamp_granularities[]": "word",
            },
            timeout=600,
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"groq {resp.status_code}: {resp.text[:500]}")
    return resp.json()


def _ffmpeg() -> str:
    """PATH first, then env override, then the winget shim location."""
    found = shutil.which("ffmpeg") or os.environ.get("FFMPEG_EXE")
    if not found:
        winget_shim = Path.home() / "AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"
        if winget_shim.exists():
            found = str(winget_shim)
    if not found:
        raise RuntimeError(
            "file exceeds the upload cap and ffmpeg is not installed to split it. "
            "Install ffmpeg (winget install Gyan.FFmpeg) and retry."
        )
    return found


def _segment(path: Path, workdir: Path) -> list[Path]:
    pattern = workdir / "seg_%04d.mp3"
    stop = threading.Event()
    t0 = time.monotonic()

    def _tick() -> None:
        while not stop.wait(30):
            n = len(list(workdir.glob("seg_*.mp3")))
            joblog.log(f"ffmpeg splitting — {n} segments so far ({int(time.monotonic() - t0)}s). Do not restart the worker.")

    ticker = threading.Thread(target=_tick, daemon=True)
    ticker.start()
    try:
        subprocess.run(
            [_ffmpeg(), "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path),
             "-f", "segment", "-segment_time", str(SEGMENT_SECONDS), "-acodec", "libmp3lame",
             "-b:a", "64k", "-ac", "1", str(pattern)],
            check=True,
        )
    finally:
        stop.set()
        ticker.join(timeout=1)
    return sorted(workdir.glob("seg_*.mp3"))


def _write_transcript(
    conn, *, catalog_id: str, episode_id: str, language: str | None,
    model: str, text: str, words: list[dict], duration_s: float,
    service: str, rate: float,
) -> float:
    hours = duration_s / 3600
    conn.execute(
        """
        INSERT INTO transcripts (episode_id, catalog_id, language, model, text, words, audio_duration_s)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (episode_id) DO UPDATE SET
            language = EXCLUDED.language, model = EXCLUDED.model, text = EXCLUDED.text,
            words = EXCLUDED.words, audio_duration_s = EXCLUDED.audio_duration_s
        """,
        (episode_id, catalog_id, language, model, text, json.dumps(words), duration_s),
    )
    conn.execute("UPDATE episodes SET duration_s = %s WHERE id = %s", (int(duration_s), episode_id))
    log_cost(
        conn, catalog_id=catalog_id, episode_id=episode_id, service=service,
        model=model, units=hours, unit_kind="audio_hours", cost_usd=hours * rate,
    )
    return hours


def transcribe_from_captions(conn, *, catalog_id: str, episode_id: str) -> float | None:
    from .captions import captions_path, snippets_to_words

    dest = captions_path(episode_id)
    if not dest.is_file() or dest.stat().st_size == 0:
        return None
    payload = json.loads(dest.read_text(encoding="utf-8"))
    words, text, duration_s = snippets_to_words(payload.get("snippets") or [])
    if not words:
        return None
    kind = "auto" if payload.get("generated") else "manual"
    lang = payload.get("language") or "und"
    joblog.log(f"using YouTube captions ({lang} {kind}, {len(words)} words) — skipping Whisper")
    return _write_transcript(
        conn, catalog_id=catalog_id, episode_id=episode_id, language=lang,
        model=f"youtube-captions-{kind}", text=text, words=words, duration_s=duration_s,
        service="youtube_captions", rate=0.0,
    )


def transcribe_episode(
    conn, *, catalog_id: str, episode_id: str, path: Path, audio_url: str = "",
) -> float:
    """Transcribe one episode, upsert the transcript, log cost. Returns audio hours."""
    captioned = transcribe_from_captions(conn, catalog_id=catalog_id, episode_id=episode_id)
    if captioned is not None:
        return captioned

    if not path.is_file() or path.stat().st_size == 0:
        if audio_url.startswith("youtube:"):
            from .captions import fetch_youtube_captions, save_captions

            payload = fetch_youtube_captions(audio_url.removeprefix("youtube:"))
            if payload:
                save_captions(episode_id, payload)
                captioned = transcribe_from_captions(conn, catalog_id=catalog_id, episode_id=episode_id)
                if captioned is not None:
                    return captioned
        raise FileNotFoundError(
            f"no audio at {path} and no YouTube captions — download stage must succeed first"
        )

    model = str(get_config(conn, "model.asr"))
    rate = float(get_config(conn, "asr_usd_per_audio_hour"))

    size_mb = path.stat().st_size / (1024 * 1024)
    if path.stat().st_size <= MAX_UPLOAD_BYTES:
        parts = [path]
        tmpdir = None
    else:
        joblog.log(
            f"audio is {size_mb:.0f}MB (over Groq's 25MB cap) — ffmpeg split can take "
            f"10–30 min at 100% CPU. Dashboard stays on 'transcribe started' until the first segment. Do not restart."
        )
        tmpdir = tempfile.TemporaryDirectory()
        parts = _segment(path, Path(tmpdir.name))

    if len(parts) > 1:
        joblog.log(f"split done — {len(parts)} segments, sending to Groq")
    words: list[dict] = []
    texts: list[str] = []
    total_duration = 0.0
    language = None
    try:
        for i, part in enumerate(parts, 1):
            # rough pre-check: estimate this part's cost from segment length before paying
            ensure_spend_allowed(conn, (SEGMENT_SECONDS / 3600) * rate)
            if len(parts) > 1:
                joblog.log(f"groq {i}/{len(parts)}")
            result = _groq_transcribe(part, model)
            if len(parts) > 1:
                joblog.log(f"segment {i}/{len(parts)} transcribed")
            offset = total_duration
            for w in result.get("words", []):
                words.append({"w": w["word"], "s": round(w["start"] + offset, 3), "e": round(w["end"] + offset, 3)})
            texts.append(result.get("text", "").strip())
            total_duration += float(result.get("duration", 0.0))
            language = language or result.get("language")
    finally:
        if tmpdir is not None:
            tmpdir.cleanup()

    return _write_transcript(
        conn, catalog_id=catalog_id, episode_id=episode_id, language=language,
        model=model, text=" ".join(texts), words=words, duration_s=total_duration,
        service="groq_whisper", rate=rate,
    )
