# Shared Python image for the ingestion worker (this file) and the query API
# (serve/) — both run from one editable-installed venv, mirroring local dev's
# "shared local venv" setup. Build context is the repo root.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

# YouTube's player challenges need a real JS runtime; without one yt-dlp runs in
# a deprecated fallback and loses formats. Deno is the runtime yt-dlp enables by
# default, so no --js-runtimes flag is needed.
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) deno_arch=x86_64-unknown-linux-gnu ;; \
      arm64) deno_arch=aarch64-unknown-linux-gnu ;; \
      *) echo "unsupported arch for deno" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/deno.zip \
      "https://github.com/denoland/deno/releases/latest/download/deno-${deno_arch}.zip"; \
    unzip -q /tmp/deno.zip -d /usr/local/bin; \
    rm /tmp/deno.zip; \
    deno --version

WORKDIR /app/pipeline
COPY pipeline/pyproject.toml ./
COPY pipeline/src ./src
COPY pipeline/migrations ./migrations
# yt-dlp: pure-Python on Linux, no winget dance needed (day-5/7 decision).
# [default] pulls the bundled EJS challenge scripts the JS runtime executes.
RUN pip install --no-cache-dir -e . "yt-dlp[default]"

WORKDIR /app/serve
COPY serve/pyproject.toml ./
COPY serve/src ./src
RUN pip install --no-cache-dir -e .

WORKDIR /app/pipeline
ENV PYTHONUNBUFFERED=1
