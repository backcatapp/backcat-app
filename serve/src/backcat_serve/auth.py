"""Keycloak JWT validation for the extension (and future fan-authenticated web).

Tokens must carry `iss` matching KEYCLOAK_ISSUER (browser-facing URL). JWKS
may be fetched from KEYCLOAK_JWKS_URL when serve runs inside Docker and cannot
reach localhost:8080 — same pattern as Auth.js's AUTH_KEYCLOAK_INTERNAL_HOST.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient


@dataclass
class AuthUser:
    id: str  # Keycloak sub
    email: str
    display_name: str | None
    roles: list[str]


def _issuer() -> str:
    return os.environ.get("KEYCLOAK_ISSUER", "http://localhost:8080/realms/backcat").rstrip("/")


def _jwks_url() -> str:
    explicit = os.environ.get("KEYCLOAK_JWKS_URL", "").strip()
    if explicit:
        return explicit
    return f"{_issuer()}/protocol/openid-connect/certs"


@lru_cache(maxsize=1)
def _jwk_client() -> PyJWKClient:
    return PyJWKClient(_jwks_url(), cache_keys=True)


def decode_bearer(token: str) -> AuthUser:
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_issuer(),
            options={"verify_aud": False},  # Keycloak access tokens often lack aud=client
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"invalid token: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="token missing sub")
    email = payload.get("email") or payload.get("preferred_username") or ""
    name = payload.get("name") or payload.get("preferred_username")
    roles = payload.get("realm_access", {}).get("roles") or []
    return AuthUser(id=sub, email=email, display_name=name, roles=list(roles))


def optional_user(request: Request) -> AuthUser | None:
    header = request.headers.get("authorization") or ""
    if not header.lower().startswith("bearer "):
        return None
    return decode_bearer(header[7:].strip())


def require_user(request: Request) -> AuthUser:
    user = optional_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Bearer token required")
    return user


# FastAPI dependency aliases
OptionalUser = Depends(optional_user)
RequireUser = Depends(require_user)
