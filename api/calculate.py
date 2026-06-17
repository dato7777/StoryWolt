"""
Vercel serverless endpoint: POST /api/calculate

Accepts JSON body:
    {
      "orderNumbersCsvText": "<orderNumbers.csv>",   // required for invoice-accurate results
      "itemsSoldCsvText": "<itemsSold.csv>"          // optional, enriches merchant SKUs
    }

Legacy (not recommended):
    { "csvText": "<itemsSold.csv only>" }

Returns calculated net income per product, per order, and period summary.
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from pathlib import Path

from auth_utils import is_request_authenticated
from commission_engine import run_calculation

CORS_HEADERS = (
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
)

# Path to bundled commission lookup table (copied from Story Phone offers export).
DEFAULT_OFFERS_PATH = Path(__file__).resolve().parent.parent / "data" / "offers_commission.xlsx"


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless handler for net income calculation."""

    def _send_json(self, status_code: int, payload: dict) -> None:
        """Write a JSON HTTP response with CORS headers for the frontend."""
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        for key, value in CORS_HEADERS:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests from the browser."""
        self.send_response(204)
        for key, value in CORS_HEADERS:
            self.send_header(key, value)
        self.end_headers()

    def do_GET(self) -> None:
        """Metadata endpoint describing required upload files."""
        self._send_json(
            200,
            {
                "service": "Story Wolt Net Income Calculator",
                "method": "POST",
                "required_file": "orderNumbers.csv (Delivery status, Items, Price)",
                "optional_file": "itemsSold.csv (Merchant SKU enrichment)",
                "example_files": [
                    "sales 0106-1506 orderNumbers.csv",
                    "sales 0106-1506 itemsSold.csv",
                ],
            },
        )

    def do_POST(self) -> None:
        """Parse uploaded CSV text and return net income calculation."""
        if not is_request_authenticated(self.headers.get("Authorization")):
            self._send_json(401, {"error": "Unauthorized. Please sign in again."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length) if content_length else b"{}"
            body = json.loads(raw_body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request body must be valid JSON."})
            return

        offers_path = Path(os.environ.get("OFFERS_XLSX_PATH", str(DEFAULT_OFFERS_PATH)))
        if not offers_path.exists():
            self._send_json(
                500,
                {"error": f"Commission lookup file not found: {offers_path}"},
            )
            return

        order_numbers_csv = body.get("orderNumbersCsvText", "").strip()
        items_sold_csv = body.get("itemsSoldCsvText", "").strip()
        payment_details_csv = body.get("paymentDetailsCsvText", "").strip()
        legacy_csv = body.get("csvText", "").strip()

        if not order_numbers_csv and not items_sold_csv and not legacy_csv:
            self._send_json(
                400,
                {
                    "error": "Upload orderNumbers.csv (required). itemsSold.csv is optional.",
                },
            )
            return

        try:
            result = run_calculation(
                offers_path,
                order_numbers_csv=order_numbers_csv or None,
                items_sold_csv=items_sold_csv or None,
                payment_details_csv=payment_details_csv or None,
                legacy_items_sold_csv=legacy_csv or None,
            )
            self._send_json(200, result)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
        except Exception as exc:  # pragma: no cover - defensive serverless guard
            self._send_json(500, {"error": f"Calculation failed: {exc}"})
