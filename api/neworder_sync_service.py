"""Orchestrate NewOrder API → Supabase sync (chunked steps with per-step commits)."""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from neworder_client import ApiBudgetExhausted, NewOrderApiError, NewOrderClient, as_list
from neworder_repository import (
    ProductDuplicateError,
    ProductUpsertInput,
    count_documents_without_line_items,
    finish_sync_run,
    get_last_sync_run,
    get_neworder_config_status,
    list_documents_without_line_items,
    load_branch_map,
    load_category_map,
    load_supplier_map,
    patch_sync_run_details,
    replace_document_line_items,
    start_sync_run,
    upsert_branch,
    upsert_category,
    upsert_customer,
    upsert_documents_batch,
    upsert_employee,
    upsert_employee_attendance,
    upsert_product,
    upsert_product_stock,
    upsert_supplier,
)
from supabase_client import db_connection

SYNC_STEPS = ("catalog", "customers", "documents", "line_items", "employees")

# Documents endpoint has no working page_num — API caps at 200 per request.
DOCUMENTS_API_CAP = 200


def get_sync_status() -> dict[str, Any]:
    config = get_neworder_config_status()
    last_sync = get_last_sync_run() if config["database_configured"] else None
    return {
        **config,
        "last_sync": _serialize_sync_run(last_sync),
        "pending_line_items": _count_pending_line_items() if config["database_configured"] else 0,
    }


def run_neworder_sync(
    *,
    mode: str = "full",
    hours: int = 24,
    max_api_calls: int = 90,
) -> dict[str, Any]:
    """Run all sync steps sequentially in one process (local dev convenience)."""
    step = (mode or "full").strip().lower()
    if step in SYNC_STEPS:
        return run_neworder_sync_step(step, hours=hours, max_api_calls=max_api_calls, finalize=True)

    if step != "full":
        raise ValueError(f"mode must be full or one of: {', '.join(SYNC_STEPS)}")

    run_id: UUID | None = None
    aggregated: dict[str, Any] = {
        "mode": "full",
        "steps_completed": [],
        "warnings": [],
    }
    product_page = 1

    for index, name in enumerate(SYNC_STEPS):
        finalize = index == len(SYNC_STEPS) - 1
        if name == "catalog":
            while True:
                result = run_neworder_sync_step(
                    "catalog",
                    hours=hours,
                    max_api_calls=max_api_calls,
                    run_id=run_id,
                    product_page_start=product_page,
                    finalize=False,
                )
                run_id = UUID(str(result["run_id"]))
                _merge_step_result(aggregated, result)
                if not result.get("has_more"):
                    break
                product_page = int(result.get("next_product_page") or product_page + 1)
            continue

        if name == "line_items":
            while True:
                result = run_neworder_sync_step(
                    "line_items",
                    hours=hours,
                    max_api_calls=max_api_calls,
                    run_id=run_id,
                    finalize=False,
                )
                run_id = UUID(str(result["run_id"]))
                _merge_step_result(aggregated, result)
                if not result.get("has_more"):
                    break
            continue

        if name == "documents":
            document_task_offset = 0
            while True:
                result = run_neworder_sync_step(
                    "documents",
                    hours=hours,
                    max_api_calls=max_api_calls,
                    run_id=run_id,
                    document_task_offset=document_task_offset,
                    finalize=False,
                )
                run_id = UUID(str(result["run_id"]))
                _merge_step_result(aggregated, result)
                if not result.get("has_more"):
                    break
                document_task_offset = int(
                    result.get("next_document_task_offset") or document_task_offset + 1
                )
            continue

        kwargs: dict[str, Any] = {
            "hours": hours,
            "max_api_calls": max_api_calls,
            "run_id": run_id,
            "finalize": finalize,
        }

        result = run_neworder_sync_step(name, **kwargs)
        run_id = UUID(str(result["run_id"]))
        _merge_step_result(aggregated, result)

    if run_id is not None:
        finish_sync_run(
            run_id,
            status="success" if not aggregated["warnings"] else "partial",
            products_upserted=int(aggregated.get("products_upserted", 0)),
            documents_upserted=int(aggregated.get("documents_upserted", 0)),
            line_items_upserted=int(aggregated.get("line_items_upserted", 0)),
            details=aggregated,
        )

    return {
        "ok": True,
        "status": "success" if not aggregated["warnings"] else "partial",
        "run_id": str(run_id) if run_id else None,
        **aggregated,
        "last_sync": get_sync_status()["last_sync"],
    }


def run_neworder_sync_step(
    step: str,
    *,
    hours: int = 24,
    max_api_calls: int = 90,
    run_id: UUID | None = None,
    product_page_start: int = 1,
    document_task_offset: int = 0,
    finalize: bool = False,
) -> dict[str, Any]:
    """
    Run one sync step. Each step commits independently.

    step: catalog | customers | documents | line_items | employees
    """
    step = (step or "").strip().lower()
    if step not in SYNC_STEPS:
        raise ValueError(f"step must be one of: {', '.join(SYNC_STEPS)}")

    hours = max(1, min(int(hours), 24 * 366))
    product_page_start = max(1, int(product_page_start))
    document_task_offset = max(0, int(document_task_offset))

    config = get_neworder_config_status()
    if not config["database_configured"]:
        raise ValueError("Database not configured. Set DATABASE_URL in .env.")
    if not config["neworder_token_configured"]:
        raise ValueError("NewOrder API token not configured. Set NEWORDER_API_TOKEN in .env.")

    token = os.environ.get("NEWORDER_API_TOKEN", "").strip()
    client = NewOrderClient(token, max_calls=max(1, max_api_calls))
    session_run_id = run_id or start_sync_run()

    stats: dict[str, Any] = {
        "step": step,
        "mode": step,
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
        "has_more": False,
        "next_product_page": None,
        "next_document_task_offset": None,
        "documents_remaining": 0,
    }

    try:
        if step == "catalog":
            stats.update(_step_catalog(client, product_page_start=product_page_start))
        elif step == "customers":
            stats.update(_step_customers(client))
        elif step == "documents":
            stats.update(
                _step_documents(client, hours=hours, task_offset=document_task_offset)
            )
        elif step == "line_items":
            stats.update(_step_line_items(client, hours=hours))
        elif step == "employees":
            stats.update(_step_employees(client))

        stats["api_calls"] = client.api_calls
        status = "partial" if stats.get("has_more") or stats.get("warnings") else "success"

        patch_sync_run_details(session_run_id, {step: _step_snapshot(stats)})

        if finalize:
            finish_sync_run(
                session_run_id,
                status=status,
                products_upserted=int(stats.get("products_upserted", 0)),
                documents_upserted=int(stats.get("documents_upserted", 0)),
                line_items_upserted=int(stats.get("line_items_upserted", 0)),
                details=stats,
            )

        return {
            "ok": True,
            "status": status,
            "run_id": str(session_run_id),
            **stats,
            "last_sync": get_sync_status()["last_sync"],
        }
    except NewOrderApiError as exc:
        stats["api_calls"] = client.api_calls
        stats["warnings"].append(str(exc))
        finish_sync_run(
            session_run_id,
            status="failed",
            products_upserted=int(stats.get("products_upserted", 0)),
            documents_upserted=int(stats.get("documents_upserted", 0)),
            line_items_upserted=int(stats.get("line_items_upserted", 0)),
            error_message=str(exc),
            details=stats,
        )
        raise


def _step_catalog(client: NewOrderClient, *, product_page_start: int) -> dict[str, Any]:
    stats = {
        "branches": 0,
        "categories": 0,
        "suppliers": 0,
        "products_upserted": 0,
        "stock_rows": 0,
        "warnings": [],
        "has_more": False,
        "next_product_page": None,
    }

    if product_page_start <= 1:
        branch_rows = as_list(client.get("/api/Bussiness/branches"))
        category_rows = as_list(client.get("/api/Products/categories"))
        supplier_rows = as_list(client.get("/api/Products/suppliers"))

        with db_connection() as conn:
            with conn.cursor() as cur:
                for row in branch_rows:
                    if isinstance(row, dict):
                        upsert_branch(cur, row)
                        stats["branches"] += 1

                category_map = load_category_map(cur)
                for row in category_rows:
                    if not isinstance(row, dict):
                        continue
                    cat_uuid = upsert_category(cur, row)
                    cat_key = str(row.get("id") or "")
                    if cat_key:
                        category_map[cat_key] = cat_uuid
                    stats["categories"] += 1

                supplier_map = load_supplier_map(cur)
                for row in supplier_rows:
                    if not isinstance(row, dict):
                        continue
                    sup_uuid = upsert_supplier(cur, row)
                    sup_key = str(row.get("id") or "")
                    if sup_key:
                        supplier_map[sup_key] = sup_uuid
                    stats["suppliers"] += 1

    with db_connection() as conn:
        with conn.cursor() as cur:
            category_map = load_category_map(cur)
            supplier_map = load_supplier_map(cur)
            branch_map = load_branch_map(cur)
            default_branch_uuid = next(iter(branch_map.values()), None)

            product_stats = _sync_products_paginated(
                client,
                cur,
                category_map=category_map,
                supplier_map=supplier_map,
                default_branch_uuid=default_branch_uuid,
                page_start=product_page_start,
            )
            stats["products_upserted"] = product_stats["upserted"]
            stats["stock_rows"] = product_stats["stock_rows"]
            stats["has_more"] = product_stats["has_more"]
            stats["next_product_page"] = product_stats.get("next_page")
            if product_stats["skipped"]:
                stats["warnings"].append(
                    f"Skipped {product_stats['skipped']} duplicate products in batch"
                )
            if product_stats.get("budget_exhausted"):
                stats["warnings"].append("Product catalog paused — API budget reached for this step")

    return stats


def _step_customers(client: NewOrderClient) -> dict[str, Any]:
    stats = {"customers": 0, "warnings": [], "has_more": False}
    page_num = 1
    page_size = 200

    while True:
        try:
            batch = client.get(
                "/api/Customers",
                {"page_size": page_size, "page_num": page_num},
            )
        except ApiBudgetExhausted:
            stats["has_more"] = True
            stats["warnings"].append("Customer sync paused — API budget reached")
            break

        rows = as_list(batch)
        if not rows:
            break

        with db_connection() as conn:
            with conn.cursor() as cur:
                for row in rows:
                    if isinstance(row, dict):
                        upsert_customer(cur, row)
                        stats["customers"] += 1

        if len(rows) < page_size:
            break
        page_num += 1

    return stats


def _sync_dates_for_hours(hours: int) -> list[date]:
    """Calendar days overlapping the last N hours (for date-only API params)."""
    hours = max(1, min(int(hours), 24 * 366))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    return _date_range_inclusive(since.date(), date.today())


def _step_documents(
    client: NewOrderClient,
    *,
    hours: int,
    task_offset: int = 0,
) -> dict[str, Any]:
    """
    Sync documents by fetching one calendar day at a time.

    The Documents endpoint does not support page_num (official schema has no
    pagination params). A single date-range call is capped at 200 rows.
    """
    stats: dict[str, Any] = {
        "documents_upserted": 0,
        "warnings": [],
        "has_more": False,
        "next_document_task_offset": None,
    }
    sync_dates = _sync_dates_for_hours(hours)

    with db_connection() as conn:
        with conn.cursor() as cur:
            branch_map = load_branch_map(cur)
    branch_ids = list(branch_map.keys()) or ["1"]

    tasks = [(sync_day, branch_id) for sync_day in sync_dates for branch_id in branch_ids]
    if task_offset >= len(tasks):
        return stats

    for index in range(task_offset, len(tasks)):
        sync_day, branch_id = tasks[index]
        day_str = _format_api_date(sync_day)
        try:
            batch = client.get(
                "/api/Documents",
                {
                    "branchId": branch_id,
                    "fromDate": day_str,
                    "toDate": day_str,
                },
            )
        except ApiBudgetExhausted:
            stats["has_more"] = True
            stats["next_document_task_offset"] = index
            stats["warnings"].append("Document sync paused — API budget reached")
            return stats

        rows = [row for row in as_list(batch) if isinstance(row, dict)]
        if len(rows) >= DOCUMENTS_API_CAP:
            stats["warnings"].append(
                f"{day_str} branch {branch_id}: {len(rows)} documents — "
                "daily cap may hide additional orders"
            )

        if rows:
            with db_connection() as conn:
                with conn.cursor() as cur:
                    stats["documents_upserted"] += upsert_documents_batch(cur, rows)

    return stats


def _date_range_inclusive(start: date, end: date) -> list[date]:
    if end < start:
        return []
    days = (end - start).days
    return [start + timedelta(days=offset) for offset in range(days + 1)]


def _step_line_items(client: NewOrderClient, *, hours: int = 24) -> dict[str, Any]:
    stats = {
        "line_items_upserted": 0,
        "documents_processed": 0,
        "warnings": [],
        "has_more": False,
        "documents_remaining": 0,
    }

    with db_connection() as conn:
        with conn.cursor() as cur:
            pending = list_documents_without_line_items(cur, limit=5000, hours=hours)
            stats["documents_remaining"] = count_documents_without_line_items(cur, hours=hours)

    for doc in pending:
        if client.api_calls >= client.max_calls:
            stats["has_more"] = True
            stats["warnings"].append("Line item sync paused — API budget reached")
            break

        invoice_id = doc.get("neworder_id")
        document_id = doc.get("id")
        if not invoice_id or not document_id:
            continue

        try:
            line_batch = client.get(
                "/api/Documents/line-items",
                {"invoiceId": invoice_id},
            )
        except ApiBudgetExhausted:
            stats["has_more"] = True
            stats["warnings"].append("Line item sync paused — API budget reached")
            break
        except NewOrderApiError as exc:
            stats["warnings"].append(f"Line items skipped for {invoice_id}: {exc}")
            continue

        items = [item for item in as_list(line_batch) if isinstance(item, dict)]
        if not items:
            items = [
                {
                    "id": "__empty__",
                    "name": "(no line items)",
                    "quantity": 0,
                    "price": 0,
                    "cost": 0,
                }
            ]

        with db_connection() as conn:
            with conn.cursor() as cur:
                stats["line_items_upserted"] += replace_document_line_items(
                    cur,
                    document_id=UUID(str(document_id)),
                    items=items,
                )
        stats["documents_processed"] += 1

    with db_connection() as conn:
        with conn.cursor() as cur:
            stats["documents_remaining"] = count_documents_without_line_items(cur, hours=hours)
            stats["has_more"] = stats["documents_remaining"] > 0

    return stats


def _step_employees(client: NewOrderClient) -> dict[str, Any]:
    stats = {"employees": 0, "attendance_rows": 0, "warnings": [], "has_more": False}

    try:
        rows = as_list(client.get("/api/Employees"))
    except ApiBudgetExhausted:
        stats["has_more"] = True
        stats["warnings"].append("Employee sync paused — API budget reached")
        return stats

    with db_connection() as conn:
        with conn.cursor() as cur:
            for row in rows:
                if isinstance(row, dict):
                    upsert_employee(cur, row)
                    stats["employees"] += 1

    now = datetime.now(timezone.utc)
    try:
        att_batch = client.get(
            "/api/Employees/attendance",
            {"month": now.month, "year": now.year},
        )
    except ApiBudgetExhausted:
        stats["has_more"] = True
        stats["warnings"].append("Attendance sync paused — API budget reached")
        return stats

    with db_connection() as conn:
        with conn.cursor() as cur:
            for row in as_list(att_batch):
                if isinstance(row, dict):
                    upsert_employee_attendance(cur, row, month=now.month, year=now.year)
                    stats["attendance_rows"] += 1

    return stats


def _sync_products_paginated(
    client: NewOrderClient,
    cur: Any,
    *,
    category_map: dict[str, UUID],
    supplier_map: dict[str, UUID],
    default_branch_uuid: UUID | None,
    page_start: int = 1,
    page_size: int = 200,
) -> dict[str, Any]:
    page_num = page_start
    upserted = 0
    skipped = 0
    stock_rows = 0
    seen_names: set[str] = set()
    seen_barcodes: set[str] = set()
    has_more = False
    next_page: int | None = None
    budget_exhausted = False

    while True:
        try:
            batch = client.get(
                "/api/Products",
                {"page_size": page_size, "page_num": page_num},
            )
        except ApiBudgetExhausted:
            budget_exhausted = True
            has_more = True
            next_page = page_num
            break

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

    return {
        "upserted": upserted,
        "skipped": skipped,
        "stock_rows": stock_rows,
        "has_more": has_more,
        "next_page": next_page,
        "budget_exhausted": budget_exhausted,
    }


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


def _count_pending_line_items() -> int:
    with db_connection() as conn:
        with conn.cursor() as cur:
            return count_documents_without_line_items(cur)


def _merge_step_result(aggregated: dict[str, Any], result: dict[str, Any]) -> None:
    aggregated["steps_completed"].append(result.get("step"))
    for key in (
        "products_upserted",
        "documents_upserted",
        "line_items_upserted",
        "customers",
        "employees",
        "branches",
        "categories",
        "suppliers",
        "stock_rows",
        "attendance_rows",
    ):
        aggregated[key] = int(aggregated.get(key, 0)) + int(result.get(key, 0))
    aggregated["warnings"].extend(result.get("warnings") or [])


def _step_snapshot(stats: dict[str, Any]) -> dict[str, Any]:
    return {
        "api_calls": stats.get("api_calls", 0),
        "products_upserted": stats.get("products_upserted", 0),
        "documents_upserted": stats.get("documents_upserted", 0),
        "line_items_upserted": stats.get("line_items_upserted", 0),
        "has_more": stats.get("has_more", False),
    }


def _format_api_date(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


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
