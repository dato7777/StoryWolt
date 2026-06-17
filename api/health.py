"""
Vercel serverless endpoint: GET /api/health

Lightweight health check used by deployment monitors and local development.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    """Return service status without loading the commission workbook."""

    def do_GET(self) -> None:
        payload = json.dumps({"status": "ok", "service": "wolt-net-income"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
