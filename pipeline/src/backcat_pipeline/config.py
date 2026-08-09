"""Settings from env, runtime config from app_config with env fallback.

Precedence (day-4 decision): DB value in app_config -> env var -> coded default.
Env var name for key "daily_spend_limit_usd" is DAILY_SPEND_LIMIT_USD, etc.
"""

import json
import os
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

# pipeline/.env, found regardless of the process cwd (serve/ imports this too)
_PIPELINE_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", str(_PIPELINE_ENV)), env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = "postgresql://backcat:backcat@localhost:5432/backcat"
    groq_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "backcatdev"


settings = Settings()

_DEFAULTS: dict[str, Any] = {
    "kill_switch": False,
    "daily_spend_limit_usd": 5.0,
    "model.asr": "whisper-large-v3-turbo",
    "asr_usd_per_audio_hour": 0.04,
    "model.embedding.openai": "text-embedding-3-small",
    "openai_embed_usd_per_mtok": 0.02,
    # Chunk windows: short enough that seeking to chunk start lands near the
    # cited claim (±15s precision bar). Eval harness (day 7) validates quality.
    "chunk.target_min_s": 30.0,
    "chunk.target_max_s": 45.0,
    "chunk.overlap_s": 10.0,
    # Below this dense cosine similarity, retrieval is treated as no-coverage
    # (honest absence). Placeholder until the day-7 eval harness tunes it.
    "retrieval.min_dense_similarity": 0.2,
    # Day-10 golden-set benchmark decides this, not preference — see docs/ARCHITECTURE.md.
    "retrieval.use_reranker": False,
    "retrieval.rerank_pool": 30,
    "model.answering": "claude-sonnet-5",
    "answering_usd_per_mtok_in": 3.0,
    "answering_usd_per_mtok_out": 15.0,
    "model.extraction": "claude-haiku-4-5",
    "extraction_usd_per_mtok_in": 1.0,
    "extraction_usd_per_mtok_out": 5.0,
    "rate_limit.questions_per_hour": 20,
    "max_job_attempts": 3,
}


def get_config(conn, key: str) -> Any:
    row = conn.execute("SELECT value FROM app_config WHERE key = %s", (key,)).fetchone()
    if row is not None:
        return row[0]
    env_val = os.environ.get(key.upper().replace(".", "_"))
    if env_val is not None:
        try:
            return json.loads(env_val)
        except json.JSONDecodeError:
            return env_val
    return _DEFAULTS.get(key)
