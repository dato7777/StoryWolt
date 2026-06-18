"""
Vercel serverless endpoint: POST /api/login

Body: { "username": "...", "password": "..." }
Returns: { "token": "...", "expiresAt": 1234567890, "username": "admin" }
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler

import _bootstrap  # noqa: F401 — must run before auth_utils import on Vercel

from auth_utils import (
    create_session_token,
    credentials_configured,
    verify_credentials,
)

CORS_HEADERS = (
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        for key, value in CORS_HEADERS:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        for key, value in CORS_HEADERS:
            self.send_header(key, value)
        self.end_headers()

    def do_POST(self) -> None:
        if not credentials_configured():
            self._send_json(
                503,
                {
                    "error": "Admin login is not configured. Set ADMIN_PASSWORD on the server.",
                },
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length) if content_length else b"{}"
            body = json.loads(raw_body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request body must be valid JSON."})
            return

        username = str(body.get("username", "")).strip()
        password = str(body.get("password", ""))

        if not verify_credentials(username, password):
            self._send_json(401, {"error": "Invalid username or password."})
            return

        token, expires_at = create_session_token()
        self._send_json(
            200,
            {
                "token": token,
                "expiresAt": expires_at,
                "username": username,
            },
        )
