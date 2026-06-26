"""Orchestrate NewOrder API → Supabase sync."""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from neworder_client import NewOrderApiError, NewOrderClient, as_list
from neworder_repository import (
    ProductDuplicateError,
    ProductUpsertInput,
    finish_sync_run,
    get_last_sync_run,
    get_neworder_config_status,
    replace_document_line_items,
    start_sync_run,
    upsert_branch,
    upsert_category,
    upsert_customer,
    upsert_document,
    upsert_employee,
    upsert_employee_attendance,
    upsert_product,
    upsert_product_stock,
    upsert_supplier,
)
from supabase_client import db_connection


def get_sync_status() -> dict[str, Any]:
    config = get_neworder_config_status()
    last_sync = get_last_sync_run() if config["database_configured"] else None
    return {
        **config,
        "last_sync": _serialize_sync_run(last_sync),
    }


def run_neworder_sync(
    *,
    mode: str = "full",
    days: int = 30,
    max_api_calls: int = 95,
) -> dict[str, Any]:
    """
    Pull data from NewOrder and upsert into no_* tables.

    mode: catalog | sales | full
    """
    mode = (mode or "full").strip().lower()
    if mode not in {"catalog", "sales", "full"}:
        raise ValueError("mode must be catalog, sales, or full")

    days = max(1, min(int(days), 366))

    config = get_neworder_config_status()
    if not config["database_configured"]:
        raise ValueError("Database not configured. Set DATABASE_URL in .env.")
    if not config["neworder_token_configured"]:
        raise ValueError("NewOrder API token not configured. Set NEWORDER_API_TOKEN in .env.")

    token = os.environ.get("NEWORDER_API_TOKEN", "").strip()
    client = NewOrderClient(token, max_calls=max_api_calls)
    run_id = start_sync_run()

    stats: dict[str, Any] = {
        "mode": mode,
        "api_calls": 0,
        "branches": 0,
        "categories": 0,
        "suppliers": 0,
        "products_upserted": 0,
        "stock_rows": 0,
        "customers": 0,
        "documents_upserted": 0,
        "line_items_upserted": 0,
        "employees": 0,
        "attendance_rows": 0,
        "warnings": [],
    }

    try:
        branch_rows = as_list(client.get("/api/Bussiness/branches"))
        category_rows = (
            as_list(client.get("/api/Products/categories"))
            if mode in {"catalog", "full"}
            else []
        )
        supplier_rows = (
            as_list(client.get("/api/Products/suppliers"))
            if mode in {"catalog", "full"}
            else []
        )

        category_map: dict[str, UUID] = {}
        supplier_map: dict[str, UUID] = {}
        branch_map: dict[str, UUID] = {}
        default_branch_uuid: UUID | None = None

        with db_connection() as conn:
            with conn.cursor() as cur:
                for row in branch_rows:
                    if not isinstance(row, dict):
                        continue
                    branch_uuid = upsert_branch(cur, row)
                    branch_key = str(row.get("branchId") or row.get("id") or "")
                    if branch_key:
                        branch_map[branch_key] = branch_uuid
                    stats["branches"] += 1
                    if default_branch_uuid is None:
                        default_branch_uuid = branch_uuid

                for row in category_rows:
                    if not isinstance(row, dict):
                        continue
                    cat_uuid = upsert_category(cur, row)
                    cat_key = str(row.get("id") or "")
                    if cat_key:
                        category_map[cat_key] = cat_uuid
                    stats["categories"] += 1

                for row in supplier_rows:
                    if not isinstance(row, dict):
                        continue
                    sup_uuid = upsert_supplier(cur, row)
                    sup_key = str(row.get("id") or "")
                    if sup_key:
                        supplier_map[sup_key] = sup_uuid
                    stats["suppliers"] += 1

                if mode in {"catalog", "full"}:
                    product_stats = _sync_products_paginated(
                        client,
                        cur,
                        category_map=category_map,
                        supplier_map=supplier_map,
                        default_branch_uuid=default_branch_uuid,
                    )
                    stats["products_upserted"] = product_stats["upserted"]
                    stats["stock_rows"] = product_stats["stock_rows"]
                    if product_stats["skipped"]:
                        stats["warnings"].append(
                            f"Skipped {product_stats['skipped']} duplicate products in batch"
                        )

                if mode in {"sales", "full"}:
                    customer_stats = _sync_customers_paginated(client, cur)
                    stats["customers"] = customer_stats["upserted"]

                if mode in {"sales", "full"}:
                    doc_stats = _sync_documents_and_lines(
                        client,
                        cur,
                        branch_map=branch_map,
                        days=days,
                    )
                    stats["documents_upserted"] = doc_stats["documents"]
                    stats["line_items_upserted"] = doc_stats["line_items"]
                    if doc_stats["documents_skipped"]:
                        stats["warnings"].append(
                            f"Stopped before line items for {doc_stats['documents_skipped']} documents (API budget)"
                        )

                if mode == "full":
                    employee_stats = _sync_employees(client, cur)
                    stats["employees"] = employee_stats["employees"]
                    stats["attendance_rows"] = employee_stats["attendance"]

        stats["api_calls"] = client.api_calls
        status = _resolve_status(stats, client)
        finish_sync_run(
            run_id,
            status=status,
            products_upserted=int(stats["products_upserted"]),
            documents_upserted=int(stats["documents_upserted"]),
            line_items_upserted=int(stats["line_items_upserted"]),
            details=stats,
        )
        return {
            "ok": status in {"success", "partial"},
            "status": status,
            "run_id": str(run_id),
            **stats,
            "last_sync": get_sync_status()["last_sync"],
        }
    except Exception as exc:
        stats["api_calls"] = client.api_calls
        finish_sync_run(
            run_id,
            status="failed",
            products_upserted=int(stats.get("products_upserted", 0)),
            documents_upserted=int(stats.get("documents_upserted", 0)),
            line_items_upserted=int(stats.get("line_items_upserted", 0)),
            error_message=str(exc),
            details=stats,
        )
        if isinstance(exc, NewOrderApiError):
            raise
        raise


def _sync_products_paginated(
    client: NewOrderClient,
    cur: Any,
    *,
    category_map: dict[str, UUID],
    supplier_map: dict[str, UUID],
    default_branch_uuid: UUID | None,
    page_size: int = 200,
) -> dict[str, int]:
    page_num = 1
    upserted = 0
    skipped = 0
    stock_rows = 0
    seen_names: set[str] = set()
    seen_barcodes: set[str] = set()

    while True:
        batch = client.get(
            "/api/Products",
            {"page_size": page_size, "page_num": page_num},
        )
        rows = as_list(batch)
        if not rows:
            break

        for row in rows:
            if not isinstance(row, dict):
                continue
            product_input = _api_product_to_upsert(row, category_map, supplier_map)
            name_key = product_input.name.strip().lower()
            barcode_key = (product_input.barcode or "").strip().upper()
            if name_key and name_key in seen_names:
                skipped += 1
                continue
            if barcode_key and barcode_key in seen_barcodes:
                skipped += 1
                continue
            try:
                result = upsert_product(cur, product_input)
            except ProductDuplicateError:
                skipped += 1
                continue
            upserted += 1
            if name_key:
                seen_names.add(name_key)
            if barcode_key:
                seen_barcodes.add(barcode_key)

            stock_qty = row.get("currentStock")
            if default_branch_uuid is not None and stock_qty is not None:
                upsert_product_stock(
                    cur,
                    product_id=result.product_id,
                    branch_id=default_branch_uuid,
                    quantity=float(stock_qty),
                )
                stock_rows += 1

        if len(rows) < page_size:
            break
        page_num += 1

    return {"upserted": upserted, "skipped": skipped, "stock_rows": stock_rows}


def _sync_customers_paginated(
    client: NewOrderClient,
    cur: Any,
    page_size: int = 200,
) -> dict[str, int]:
    page_num = 1
    upserted = 0
    while True:
        batch = client.get(
            "/api/Customers",
            {"page_size": page_size, "page_num": page_num},
        )
        rows = as_list(batch)
        if not rows:
            break
        for row in rows:
            if isinstance(row, dict):
                upsert_customer(cur, row)
                upserted += 1
        if len(rows) < page_size:
            break
        page_num += 1
    return {"upserted": upserted}


def _sync_documents_and_lines(
    client: NewOrderClient,
    cur: Any,
    *,
    branch_map: dict[str, UUID],
    days: int,
) -> dict[str, int]:
    to_date = date.today()
    from_date = to_date - timedelta(days=days - 1)
    from_str = _format_api_date(from_date)
    to_str = _format_api_date(to_date)

    documents = 0
    line_items = 0
    documents_skipped = 0

    branch_ids = list(branch_map.keys()) or ["1"]
    for branch_id in branch_ids:
        batch = client.get(
            "/api/Documents",
            {
                "branchId": branch_id,
                "fromDate": from_str,
                "toDate": to_str,
            },
        )
        rows = as_list(batch)
        for row in rows:
            if not isinstance(row, dict):
                continue
            doc_uuid = upsert_document(cur, row)
            documents += 1

            if client.api_calls >= client.max_calls:
                documents_skipped += 1
                continue

            invoice_id = row.get("id")
            if invoice_id is None:
                continue
            try:
                line_batch = client.get(
                    "/api/Documents/line-items",
                    {"invoiceId": invoice_id},
                )
            except NewOrderApiError:
                documents_skipped += 1
                continue

            items = as_list(line_batch)
            if items:
                line_items += replace_document_line_items(
                    cur,
                    document_id=doc_uuid,
                    items=[item for item in items if isinstance(item, dict)],
                )

    return {
        "documents": documents,
        "line_items": line_items,
        "documents_skipped": documents_skipped,
    }


def _sync_employees(client: NewOrderClient, cur: Any) -> dict[str, int]:
    rows = as_list(client.get("/api/Employees"))
    employees = 0
    for row in rows:
        if isinstance(row, dict):
            upsert_employee(cur, row)
            employees += 1

    now = datetime.now(timezone.utc)
    attendance_rows = 0
    att_batch = client.get(
        "/api/Employees/attendance",
        {"month": now.month, "year": now.year},
    )
    for row in as_list(att_batch):
        if isinstance(row, dict):
            upsert_employee_attendance(cur, row, month=now.month, year=now.year)
            attendance_rows += 1

    return {"employees": employees, "attendance": attendance_rows}


def _api_product_to_upsert(
    row: dict[str, Any],
    category_map: dict[str, UUID],
    supplier_map: dict[str, UUID],
) -> ProductUpsertInput:
    category = row.get("category") or {}
    supplier = row.get("supplier") or {}
    if not isinstance(category, dict):
        category = {}
    if not isinstance(supplier, dict):
        supplier = {}

    cat_key = str(category.get("id") or "")
    sup_key = str(supplier.get("id") or "")

    extra = row.get("additionalBarcodes") or []
    if isinstance(extra, str):
        extra = [extra]
    elif not isinstance(extra, list):
        extra = []

    is_stock = row.get("isStock")
    is_active = row.get("isActive")

    return ProductUpsertInput(
        neworder_id=str(row.get("id") or ""),
        name=str(row.get("name") or ""),
        barcode=str(row.get("barcode") or ""),
        cost_no_tax=_num(row.get("costNoTax")),
        cost=_num(row.get("cost")),
        price=_num(row.get("price")),
        is_serial=bool(row.get("isSerial")),
        category_id=category_map.get(cat_key),
        category_name=category.get("name"),
        supplier_id=supplier_map.get(sup_key),
        supplier_name=supplier.get("name"),
        is_tax_free=bool(row.get("isTaxFree")),
        is_stock=True if is_stock is None else bool(is_stock),
        is_active=True if is_active is None else bool(is_active),
        description=row.get("description"),
        additional_barcodes=tuple(str(code) for code in extra if code),
    )


def _format_api_date(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _resolve_status(stats: dict[str, Any], client: NewOrderClient) -> str:
    if stats.get("warnings"):
        return "partial"
    if client.api_calls >= client.max_calls:
        return "partial"
    return "success"


def _serialize_sync_run(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    out = dict(row)
    if out.get("id") is not None:
        out["id"] = str(out["id"])
    for key in ("started_at", "finished_at"):
        value = out.get(key)
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    return out
