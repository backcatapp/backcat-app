"""Time-aligned chunking: short windows aligned to word boundaries.

Window sizes are config-driven (app_config: chunk.target_min_s / target_max_s /
overlap_s). Defaults are 30–45s with 10s overlap — short enough that a player
seeked to the chunk start lands close to the cited claim (the ±15s precision
bar). Windows prefer to break at sentence-ending words once past the minimum;
otherwise they hard-cut at the max. Chunk IDs are deterministic on
(episode_id, start_ms) so re-chunking replaces rather than duplicates.
"""

import json

from .config import get_config
from .ids import det_id

TARGET_MIN_S = 30.0
TARGET_MAX_S = 45.0
OVERLAP_S = 10.0

_SENTENCE_END = (".", "?", "!")


def build_windows(
    words: list[dict],
    target_min_s: float = TARGET_MIN_S,
    target_max_s: float = TARGET_MAX_S,
    overlap_s: float = OVERLAP_S,
) -> list[dict]:
    """words: [{"w": str, "s": float, "e": float}] -> [{"start_s", "end_s", "text"}]."""
    out: list[dict] = []
    n = len(words)
    i = 0
    while i < n:
        t0 = words[i]["s"]
        j = i
        sentence_end = None
        while j < n and words[j]["e"] - t0 <= target_max_s:
            if words[j]["e"] - t0 >= target_min_s and words[j]["w"].strip().endswith(_SENTENCE_END):
                sentence_end = j
            j += 1
        if j >= n:
            end = n - 1
        elif sentence_end is not None:
            end = sentence_end
        else:
            end = max(j - 1, i)
        out.append(
            {
                "start_s": t0,
                "end_s": words[end]["e"],
                "text": " ".join(w["w"].strip() for w in words[i : end + 1]),
            }
        )
        if end >= n - 1:
            break
        overlap_from = words[end]["e"] - overlap_s
        k = i + 1
        while k <= end and words[k]["s"] < overlap_from:
            k += 1
        i = max(k, i + 1)
    return out


def chunk_episode(conn, *, catalog_id: str, episode_id: str) -> int:
    row = conn.execute("SELECT words FROM transcripts WHERE episode_id = %s", (episode_id,)).fetchone()
    if row is None:
        raise RuntimeError("no transcript yet — transcribe stage must run first")
    words = row[0] if isinstance(row[0], list) else json.loads(row[0])
    windows = build_windows(
        words,
        target_min_s=float(get_config(conn, "chunk.target_min_s")),
        target_max_s=float(get_config(conn, "chunk.target_max_s")),
        overlap_s=float(get_config(conn, "chunk.overlap_s")),
    )

    ids = []
    for w in windows:
        chunk_id = det_id(episode_id, str(int(w["start_s"] * 1000)))
        ids.append(chunk_id)
        conn.execute(
            """
            INSERT INTO chunks (id, catalog_id, episode_id, start_s, end_s, text)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET end_s = EXCLUDED.end_s, text = EXCLUDED.text
            """,
            (chunk_id, catalog_id, episode_id, w["start_s"], w["end_s"], w["text"]),
        )
    # A changed transcript can shift window boundaries — drop chunks that no
    # longer exist so re-chunking stays an exact replacement.
    conn.execute(
        "DELETE FROM chunks WHERE episode_id = %s AND NOT (id = ANY(%s))", (episode_id, ids)
    )
    return len(windows)
