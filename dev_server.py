"""
Local development HTTP server for Python API routes.

Use this during frontend development when Vercel CLI is not running:
    python dev_server.py

Frontend vite.config.ts proxies /api/* to http://localhost:3001

Admin credentials: copy .env.example → .env and set ADMIN_PASSWORD (and AUTH_SECRET).
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# Ensure api modules are importable when running from project root.
ROOT_DIR = Path(__file__).resolve().parent
API_DIR = ROOT_DIR / "api"
sys.path.insert(0, str(API_DIR))

from auth_utils import (  # noqa: E402
    create_session_token,
    credentials_configured,
    is_request_authenticated,
    verify_credentials,
)
from commission_engine import run_calculation  # noqa: E402

OFFERS_PATH = ROOT_DIR / "data" / "offers_commission.xlsx"
PORT = 3001

CORS_HEADERS = (
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
)


def load_dotenv_file(path: Path) -> None:
    """Load KEY=VALUE pairs from .env into os.environ (does not override existing)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


class DevHandler(BaseHTTPRequestHandler):
    """Dev server mimicking Vercel /api/* routes with admin auth."""

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
        if self.path == "/api/session":
            if is_request_authenticated(self.headers.get("Authorization")):
                self._send_json(
                    200,
                    {
                        "authenticated": True,
                        "username": os.environ.get("ADMIN_USERNAME", "admin").strip(),
                    },
                )
            else:
                self._send_json(401, {"authenticated": False})
            return

        if self.path == "/api/health":
            self._send_json(200, {"status": "ok", "service": "wolt-net-income-dev"})
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"

        if self.path == "/api/login":
            if not credentials_configured():
                self._send_json(
                    503,
                    {
                        "error": "Admin login is not configured. Set ADMIN_PASSWORD in .env",
                    },
                )
                return
            try:
                body = json.loads(raw.decode("utf-8"))
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
                {"token": token, "expiresAt": expires_at, "username": username},
            )
            return

        if self.path == "/api/calculate":
            if not is_request_authenticated(self.headers.get("Authorization")):
                self._send_json(401, {"error": "Unauthorized. Please sign in again."})
                return

            try:
                body = json.loads(raw.decode("utf-8"))
                order_numbers = body.get("orderNumbersCsvText", "").strip()
                items_sold = body.get("itemsSoldCsvText", "").strip()
                payment_details = body.get("paymentDetailsCsvText", "").strip()
                legacy = body.get("csvText", "").strip()
                if not order_numbers and not items_sold and not legacy:
                    raise ValueError(
                        "Upload orderNumbers.csv (required). itemsSold.csv is optional."
                    )
                result = run_calculation(
                    OFFERS_PATH,
                    order_numbers_csv=order_numbers or None,
                    items_sold_csv=items_sold or None,
                    payment_details_csv=payment_details or None,
                    legacy_items_sold_csv=legacy or None,
                )
                self._send_json(200, result)
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})
            except Exception as exc:
                self._send_json(500, {"error": str(exc)})
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        print(f"[dev_server] {self.address_string()} {format % args}")


if __name__ == "__main__":
    load_dotenv_file(ROOT_DIR / ".env")
    server = HTTPServer(("0.0.0.0", PORT), DevHandler)
    print(f"Dev API running at http://127.0.0.1:{PORT}")
    if not credentials_configured():
        print("WARNING: ADMIN_PASSWORD not set — copy .env.example to .env and configure admin login.")
    server.serve_forever()
