"""
Local development HTTP server — delegates to api/handlers.py (same as Vercel).

    python dev_server.py

Frontend vite.config.ts proxies /api/* to http://localhost:3001
"""

from __future__ import annotations

import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).resolve().parent
API_DIR = ROOT_DIR / "api"
sys.path.insert(0, str(API_DIR))

import handlers  # noqa: E402
from auth_utils import credentials_configured  # noqa: E402
from supabase_client import is_db_configured  # noqa: E402

PORT = 3001


def load_dotenv_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


class DevHandler(BaseHTTPRequestHandler):
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
        elif path == "/api/timelines":
            handlers.handle_timelines_list_get(self)
        elif path == "/api/analytics/period":
            handlers.handle_analytics_period_get(self)
        elif path == "/api/analytics/overall":
            handlers.handle_analytics_overall_get(self)
        elif path == "/api/neworder/status":
            handlers.handle_neworder_status_get(self)
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

    def log_message(self, format: str, *args) -> None:
        print(f"[dev_server] {self.address_string()} {format % args}")


if __name__ == "__main__":
    load_dotenv_file(ROOT_DIR / ".env")
    server = HTTPServer(("0.0.0.0", PORT), DevHandler)
    print(f"Dev API running at http://127.0.0.1:{PORT}")
    if not credentials_configured():
        print("WARNING: ADMIN_PASSWORD not set — copy .env.example to .env")
    if is_db_configured():
        print("Database: configured (timelines + commission catalog)")
    else:
        print("Database: not configured — set DATABASE_URL in .env for Supabase")
    server.serve_forever()
