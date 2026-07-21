"""Settings from env, runtime config from app_config with env fallback.

Precedence (day-4 decision): DB value in app_config -> env var -> coded default.
Env var name for key "daily_spend_limit_usd" is DAILY_SPEND_LIMIT_USD, etc.
"""

import json
import os
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://backcat:backcat@localhost:5432/backcat"
    groq_api_key: str = ""


settings = Settings()

_DEFAULTS: dict[str, Any] = {
    "kill_switch": False,
    "daily_spend_limit_usd": 5.0,
    "model.asr": "whisper-large-v3-turbo",
    "asr_usd_per_audio_hour": 0.04,
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
