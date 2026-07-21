"""Audio download stage. Follows enclosure redirects, streams to disk, skips existing files."""

from pathlib import Path

import httpx

AUDIO_DIR = Path("data/audio")


def audio_path(episode_id: str) -> Path:
    return AUDIO_DIR / f"{episode_id}.audio"


def download_episode(episode_id: str, audio_url: str) -> Path:
    dest = audio_path(episode_id)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")
    with httpx.stream("GET", audio_url, follow_redirects=True, timeout=120) as resp:
        resp.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in resp.iter_bytes(chunk_size=1 << 20):
                f.write(chunk)
    tmp.replace(dest)
    return dest
