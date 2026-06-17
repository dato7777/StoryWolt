"""
Vercel serverless endpoint: GET /api/session

Validates Authorization: Bearer <token> and returns session info.
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler

from auth_utils import extract_bearer_token, verify_session_token

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

    def do_GET(self) -> None:
        token = extract_bearer_token(self.headers.get("Authorization"))
        if not verify_session_token(token):
            self._send_json(401, {"authenticated": False})
            return

        self._send_json(
            200,
            {
                "authenticated": True,
                "username": os.environ.get("ADMIN_USERNAME", "admin").strip(),
            },
        )
