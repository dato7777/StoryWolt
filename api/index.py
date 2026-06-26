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
        elif path == "/api/timelines":
            handlers.handle_timelines_list_get(self)
        elif path == "/api/analytics/period":
            handlers.handle_analytics_period_get(self)
        elif path == "/api/analytics/overall":
            handlers.handle_analytics_overall_get(self)
        elif path == "/api/neworder/status":
            handlers.handle_neworder_status_get(self)
        elif path == "/api/neworder/dashboard":
            handlers.handle_neworder_dashboard_get(self)
        elif path.startswith("/api/neworder/products/") and path.endswith("/min-stock"):
            product_id = path.removeprefix("/api/neworder/products/").removesuffix("/min-stock").strip("/")
            if product_id:
                handlers.handle_neworder_product_min_stock_patch(self, product_id)
            else:
                handlers.send_json(self, 404, {"error": "Product id required"})
        elif path.startswith("/api/timelines/"):
            timeline_id = path.removeprefix("/api/timelines/").strip("/")
            if timeline_id:
                handlers.handle_timeline_get(self, timeline_id)
            else:
                handlers.send_json(self, 404, {"error": "Timeline id required"})
        else:
            handlers.send_json(self, 404, {"error": f"Not found: {path}"})

    def do_POST(self) -> None:
        path = self._path()
        if path == "/api/login":
            handlers.handle_login_post(self)
        elif path == "/api/calculate":
            handlers.handle_calculate_post(self)
        elif path == "/api/neworder/sync":
            handlers.handle_neworder_sync_post(self)
        else:
            handlers.send_json(self, 404, {"error": f"Not found: {path}"})

    def do_PATCH(self) -> None:
        path = self._path()
        if path.startswith("/api/neworder/products/") and path.endswith("/min-stock"):
            product_id = path.removeprefix("/api/neworder/products/").removesuffix("/min-stock").strip("/")
            if product_id:
                handlers.handle_neworder_product_min_stock_patch(self, product_id)
            else:
                handlers.send_json(self, 404, {"error": "Product id required"})
        else:
            handlers.send_json(self, 404, {"error": f"Not found: {path}"})

    def do_DELETE(self) -> None:
        path = self._path()
        if path.startswith("/api/timelines/"):
            timeline_id = path.removeprefix("/api/timelines/").strip("/")
            if timeline_id:
                handlers.handle_timeline_delete(self, timeline_id)
            else:
                handlers.send_json(self, 404, {"error": "Timeline id required"})
        else:
            handlers.send_json(self, 404, {"error": f"Not found: {path}"})
