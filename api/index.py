"""
Single Vercel Python entrypoint for all /api/* routes.

Vercel deploys each api/*.py with `class handler` as a separate function and does
not reliably bundle sibling modules. One router + @vercel/python includeFiles fixes that.
"""

from __future__ import annotations

import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

_API_DIR = Path(__file__).resolve().parent
if str(_API_DIR) not in sys.path:
    sys.path.insert(0, str(_API_DIR))

import handlers  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def _path(self) -> str:
        return urlparse(self.path).path.rstrip("/") or "/"

    def do_OPTIONS(self) -> None:
        handlers.send_options(self)

    def do_GET(self) -> None:
        path = self._path()
        if path == "/api/health":
            handlers.handle_health_get(self)
        elif path == "/api/session":
            handlers.handle_session_get(self)
        elif path == "/api/calculate":
            handlers.handle_calculate_get(self)
        else:
            handlers.send_json(self, 404, {"error": f"Not found: {path}"})

    def do_POST(self) -> None:
        path = self._path()
        if path == "/api/login":
            handlers.handle_login_post(self)
        elif path == "/api/calculate":
            handlers.handle_calculate_post(self)
        else:
            handlers.send_json(self, 404, {"error": f"Not found: {path}"})
