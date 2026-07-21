"""Deterministic IDs — the idempotency foundation. Same inputs, same ID, forever."""

import hashlib


def det_id(*parts: str) -> str:
    joined = "|".join(parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:16]
