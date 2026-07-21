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
    subprocess.run(
        [_ffmpeg(), "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-f", "segment", "-segment_time", str(SEGMENT_SECONDS), "-acodec", "libmp3lame",
         "-b:a", "64k", "-ac", "1", str(pattern)],
        check=True,
    )
    return sorted(workdir.glob("seg_*.mp3"))


def transcribe_episode(conn, *, catalog_id: str, episode_id: str, path: Path) -> float:
    """Transcribe one episode, upsert the transcript, log cost. Returns audio hours."""
    model = str(get_config(conn, "model.asr"))
    rate = float(get_config(conn, "asr_usd_per_audio_hour"))

    if path.stat().st_size <= MAX_UPLOAD_BYTES:
        parts = [path]
        tmpdir = None
    else:
        tmpdir = tempfile.TemporaryDirectory()
        parts = _segment(path, Path(tmpdir.name))

    if len(parts) > 1:
        joblog.log(f"audio over upload cap — split into {len(parts)} segments")
    words: list[dict] = []
    texts: list[str] = []
    total_duration = 0.0
    language = None
    try:
        for i, part in enumerate(parts, 1):
            # rough pre-check: estimate this part's cost from segment length before paying
            ensure_spend_allowed(conn, (SEGMENT_SECONDS / 3600) * rate)
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

    hours = total_duration / 3600
    conn.execute(
        """
        INSERT INTO transcripts (episode_id, catalog_id, language, model, text, words, audio_duration_s)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (episode_id) DO UPDATE SET
            language = EXCLUDED.language, model = EXCLUDED.model, text = EXCLUDED.text,
            words = EXCLUDED.words, audio_duration_s = EXCLUDED.audio_duration_s
        """,
        (episode_id, catalog_id, language, model, " ".join(texts), json.dumps(words), total_duration),
    )
    conn.execute("UPDATE episodes SET duration_s = %s WHERE id = %s", (int(total_duration), episode_id))
    log_cost(
        conn, catalog_id=catalog_id, episode_id=episode_id, service="groq_whisper",
        model=model, units=hours, unit_kind="audio_hours", cost_usd=hours * rate,
    )
    return hours
