"""Embedder abstraction (day-3 decision) + the embed stage.

Two implementations planned: OpenAI text-embedding-3-small (default) and
self-hosted bge-m3 (fallback/multilingual). Each model writes to its own
table — vectors from different models are never mixed. The catalog's
embedding_provider column picks the implementation.
"""

import httpx

from .config import get_config, settings
from .costs import ensure_spend_allowed, log_cost

BATCH_SIZE = 100


class OpenAIEmbedder:
    provider = "openai"
    table = "embeddings_openai_3small"
    dim = 1536

    def __init__(self, model: str, usd_per_mtok: float):
        self.model = model
        self.usd_per_mtok = usd_per_mtok
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set — add it to pipeline/.env")

    def embed(self, texts: list[str]) -> tuple[list[list[float]], int]:
        resp = httpx.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": self.model, "input": texts},
            timeout=120,
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"openai {resp.status_code}: {resp.text[:500]}")
        data = resp.json()
        vectors = [d["embedding"] for d in sorted(data["data"], key=lambda d: d["index"])]
        return vectors, int(data["usage"]["total_tokens"])


def get_embedder(conn, provider: str) -> OpenAIEmbedder:
    if provider == "openai":
        return OpenAIEmbedder(
            model=str(get_config(conn, "model.embedding.openai")),
            usd_per_mtok=float(get_config(conn, "openai_embed_usd_per_mtok")),
        )
    raise RuntimeError(f"embedding provider '{provider}' not implemented yet (bge-m3 is post-MVP)")


def embed_episode(conn, *, catalog_id: str, episode_id: str) -> tuple[int, int]:
    """Embed all not-yet-embedded chunks of an episode. Returns (chunks, tokens)."""
    provider = conn.execute(
        "SELECT embedding_provider FROM catalogs WHERE id = %s", (catalog_id,)
    ).fetchone()[0]
    embedder = get_embedder(conn, provider)

    rows = conn.execute(
        f"""
        SELECT c.id, c.text FROM chunks c
        LEFT JOIN {embedder.table} e ON e.chunk_id = c.id
        WHERE c.episode_id = %s AND e.chunk_id IS NULL
        ORDER BY c.start_s
        """,
        (episode_id,),
    ).fetchall()
    if not rows:
        return 0, 0

    total_tokens = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        texts = [r[1] for r in batch]
        est_tokens = sum(len(t) // 4 + 1 for t in texts)
        ensure_spend_allowed(conn, (est_tokens / 1_000_000) * embedder.usd_per_mtok)
        vectors, tokens = embedder.embed(texts)
        total_tokens += tokens
        for (chunk_id, _), vec in zip(batch, vectors):
            conn.execute(
                f"""
                INSERT INTO {embedder.table} (chunk_id, catalog_id, embedding)
                VALUES (%s, %s, %s)
                ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding
                """,
                (chunk_id, catalog_id, "[" + ",".join(f"{v:.7f}" for v in vec) + "]"),
            )
    log_cost(
        conn, catalog_id=catalog_id, episode_id=episode_id, service="openai_embed",
        model=embedder.model, units=total_tokens, unit_kind="tokens",
        cost_usd=(total_tokens / 1_000_000) * embedder.usd_per_mtok,
    )
    return len(rows), total_tokens
