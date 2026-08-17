# Eval harness image — deliberately NOT pipeline/Dockerfile.
#
# `run` needs a cross-encoder (torch + sentence-transformers). That stack is
# ~1GB installed and is pure batch tooling: shipping it in the worker/serve
# images would bloat every production deploy for something no request path ever
# calls. Keeping it here means `docker compose up -d` is unaffected.
#
# torch comes from PyTorch's CPU-only index: the default wheel drags in CUDA
# runtime libraries that are dead weight on a GPU-less server.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/pipeline
COPY pipeline/pyproject.toml ./
COPY pipeline/src ./src
COPY pipeline/migrations ./migrations
RUN pip install --no-cache-dir -e .

WORKDIR /app/eval
COPY eval/pyproject.toml ./
COPY eval/src ./src
RUN pip install --no-cache-dir -e . \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir "sentence-transformers>=3.0"

ENV PYTHONUNBUFFERED=1
