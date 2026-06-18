"""Shared HTTP handlers for all /api/* routes (local dev + Vercel)."""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from pathlib import Path

from auth_utils import (
    create_session_token,
    credentials_configured,
    extract_bearer_token,
    is_request_authenticated,
    verify_credentials,
    verify_session_token,
)
from commission_engine import run_calculation

CORS_HEADERS = (
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
)

DEFAULT_OFFERS_PATH = Path(__file__).resolve().parent.parent / "data" / "offers_commission.xlsx"


def send_json(handler: BaseHTTPRequestHandler, status_code: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    for key, value in CORS_HEADERS:
        handler.send_header(key, value)
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def send_options(handler: BaseHTTPRequestHandler) -> None:
    handler.send_response(204)
    for key, value in CORS_HEADERS:
        handler.send_header(key, value)
    handler.end_headers()


def handle_health_get(handler: BaseHTTPRequestHandler) -> None:
    send_json(handler, 200, {"status": "ok", "service": "wolt-net-income"})


def handle_session_get(handler: BaseHTTPRequestHandler) -> None:
    token = extract_bearer_token(handler.headers.get("Authorization"))
    if not verify_session_token(token):
        send_json(handler, 401, {"authenticated": False})
        return
    send_json(
        handler,
        200,
        {
            "authenticated": True,
            "username": os.environ.get("ADMIN_USERNAME", "admin").strip(),
        },
    )


def handle_login_post(handler: BaseHTTPRequestHandler) -> None:
    if not credentials_configured():
        send_json(
            handler,
            503,
            {"error": "Admin login is not configured. Set ADMIN_PASSWORD on the server."},
        )
        return

    try:
        content_length = int(handler.headers.get("Content-Length", "0"))
        raw_body = handler.rfile.read(content_length) if content_length else b"{}"
        body = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        send_json(handler, 400, {"error": "Request body must be valid JSON."})
        return

    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))

    if not verify_credentials(username, password):
        send_json(handler, 401, {"error": "Invalid username or password."})
        return

    token, expires_at = create_session_token()
    send_json(
        handler,
        200,
        {"token": token, "expiresAt": expires_at, "username": username},
    )


def handle_calculate_get(handler: BaseHTTPRequestHandler) -> None:
    send_json(
        handler,
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


def handle_calculate_post(handler: BaseHTTPRequestHandler) -> None:
    if not is_request_authenticated(handler.headers.get("Authorization")):
        send_json(handler, 401, {"error": "Unauthorized. Please sign in again."})
        return

    try:
        content_length = int(handler.headers.get("Content-Length", "0"))
        raw_body = handler.rfile.read(content_length) if content_length else b"{}"
        body = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        send_json(handler, 400, {"error": "Request body must be valid JSON."})
        return

    offers_path = Path(os.environ.get("OFFERS_XLSX_PATH", str(DEFAULT_OFFERS_PATH)))
    if not offers_path.exists():
        send_json(handler, 500, {"error": f"Commission lookup file not found: {offers_path}"})
        return

    order_numbers_csv = body.get("orderNumbersCsvText", "").strip()
    items_sold_csv = body.get("itemsSoldCsvText", "").strip()
    payment_details_csv = body.get("paymentDetailsCsvText", "").strip()
    legacy_csv = body.get("csvText", "").strip()

    if not order_numbers_csv and not items_sold_csv and not legacy_csv:
        send_json(
            handler,
            400,
            {"error": "Upload orderNumbers.csv (required). itemsSold.csv is optional."},
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
        send_json(handler, 200, result)
    except ValueError as exc:
        send_json(handler, 400, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover
        send_json(handler, 500, {"error": f"Calculation failed: {exc}"})
