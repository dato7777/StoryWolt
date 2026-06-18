"""
Admin authentication helpers (no Supabase).

Credentials and signing secret come from environment variables:
    ADMIN_USERNAME  — login name (default: admin)
    ADMIN_PASSWORD  — required; API rejects logins if unset
    AUTH_SECRET     — HMAC signing key for session tokens (required in production)

Set these in:
    - Local dev:  STORY/wolt-net-income/.env  (loaded by dev_server.py)
    - Vercel:     Project → Settings → Environment Variables
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

TOKEN_TTL_SECONDS = int(os.environ.get("AUTH_TOKEN_TTL_SECONDS", str(60 * 60 * 24)))  # 24h


def _admin_username() -> str:
    return os.environ.get("ADMIN_USERNAME", "admin").strip()


def _admin_password() -> str:
    return os.environ.get("ADMIN_PASSWORD", "").strip()


def _auth_secret() -> str:
    return os.environ.get("AUTH_SECRET", "dev-only-change-me").strip()


def credentials_configured() -> bool:
    """True when ADMIN_PASSWORD is set on the server."""
    return bool(_admin_password())


def verify_credentials(username: str, password: str) -> bool:
    """Constant-time compare against env-configured admin credentials."""
    if not credentials_configured():
        return False
    expected_user = _admin_username()
    expected_pass = _admin_password()
    if len(username.strip()) != len(expected_user) or len(password) != len(expected_pass):
        return False
    user_ok = hmac.compare_digest(username.strip(), expected_user)
    pass_ok = hmac.compare_digest(password, expected_pass)
    return user_ok and pass_ok


def create_session_token() -> tuple[str, int]:
    """Return (signed token, expires_at unix timestamp)."""
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = {"exp": expires_at, "sub": _admin_username()}
    payload_b64 = (
        base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode())
        .decode()
        .rstrip("=")
    )
    signature = hmac.new(
        _auth_secret().encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_b64}.{signature}", expires_at


def verify_session_token(token: str | None) -> bool:
    """Validate HMAC signature and expiry."""
    if not token or "." not in token:
        return False
    try:
        payload_b64, signature = token.rsplit(".", 1)
        expected = hmac.new(
            _auth_secret().encode(),
            payload_b64.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return False
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        return int(payload.get("exp", 0)) > time.time()
    except (ValueError, json.JSONDecodeError, TypeError):
        return False


def extract_bearer_token(authorization_header: str | None) -> str | None:
    """Parse 'Bearer <token>' from Authorization header."""
    if not authorization_header:
        return None
    parts = authorization_header.strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def is_request_authenticated(authorization_header: str | None) -> bool:
    return verify_session_token(extract_bearer_token(authorization_header))
