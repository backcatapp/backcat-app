# Shared Python image for the ingestion worker (this file) and the query API
# (serve/) — both run from one editable-installed venv, mirroring local dev's
# "shared local venv" setup. Build context is the repo root.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/pipeline
COPY pipeline/pyproject.toml ./
COPY pipeline/src ./src
COPY pipeline/migrations ./migrations
# yt-dlp: pure-Python on Linux, no winget dance needed (day-5/7 decision).
RUN pip install --no-cache-dir -e . yt-dlp

WORKDIR /app/serve
COPY serve/pyproject.toml ./
COPY serve/src ./src
RUN pip install --no-cache-dir -e .

WORKDIR /app/pipeline
ENV PYTHONUNBUFFERED=1
