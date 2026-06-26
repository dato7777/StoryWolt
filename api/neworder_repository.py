"""Persist NewOrder sync data in Supabase / PostgreSQL."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from typing import Any
from uuid import UUID

from psycopg2.extras import Json

from neworder_normalize import normalize_barcode, normalize_product_name
from supabase_client import db_connection, is_db_configured


class ProductDuplicateError(ValueError):
    """Raised when a product cannot be stored without breaking name/SKU uniqueness."""


@dataclass(frozen=True)
class ProductUpsertInput:
    neworder_id: str
    name: str
    barcode: str = ""
    cost_no_tax: float | None = None
    cost: float | None = None
    price: float | None = None
    is_serial: bool = False
    category_id: UUID | None = None
    category_name: str | None = None
    supplier_id: UUID | None = None
    supplier_name: str | None = None
    is_tax_free: bool = False
    is_stock: bool = True
    is_active: bool = True
    description: str | None = None
    additional_barcodes: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProductUpsertResult:
    product_id: UUID
    created: bool
    deactivated_conflicts: int


def is_neworder_db_ready() -> bool:
    return is_db_configured()


def _deactivate_conflicting_products(
    cur: Any,
    *,
    neworder_id: str,
    name_normalized: str,
    barcode_normalized: str,
) -> int:
    """Soft-deactivate other active products that share the same name or SKU."""
    cur.execute(
        """
        update no_products
        set is_active = false,
            updated_at = now(),
            synced_at = now()
        where is_active = true
          and neworder_id <> %s
          and (
            (name_normalized = %s and name_normalized <> '')
            or (
              barcode_normalized = %s
              and barcode_normalized <> ''
            )
          )
        """,
        (neworder_id, name_normalized, barcode_normalized),
    )
    return int(cur.rowcount)


def _deactivate_conflicting_additional_barcodes(
    cur: Any,
    *,
    product_id: UUID,
    barcodes: list[str],
) -> None:
    if not barcodes:
        return
    cur.execute(
        """
        update no_product_barcodes
        set is_active = false,
            synced_at = now()
        where is_active = true
          and product_id <> %s::uuid
          and barcode_normalized = any(%s::text[])
        """,
        (str(product_id), barcodes),
    )


def _replace_additional_barcodes(
    cur: Any,
    *,
    product_id: UUID,
    barcodes: list[tuple[str, str]],
) -> None:
    cur.execute(
        """
        update no_product_barcodes
        set is_active = false,
            synced_at = now()
        where product_id = %s::uuid
        """,
        (str(product_id),),
    )
    if not barcodes:
        return
    cur.executemany(
        """
        insert into no_product_barcodes (
          product_id, barcode, barcode_normalized, is_active, synced_at
        ) values (%s::uuid, %s, %s, true, now())
        on conflict (product_id, barcode_normalized)
        do update set
          barcode = excluded.barcode,
          is_active = true,
          synced_at = now()
        """,
        [(str(product_id), raw, norm) for raw, norm in barcodes],
    )


def upsert_product(cur: Any, product: ProductUpsertInput) -> ProductUpsertResult:
    """
    Upsert one product by NewOrder id.
    Ensures no duplicate active product names or SKUs (deactivates stale rows first).
    """
    neworder_id = str(product.neworder_id).strip()
    if not neworder_id:
        raise ValueError("neworder_id is required")

    name = str(product.name).strip()
    if not name:
        raise ValueError("product name is required")

    name_normalized = normalize_product_name(name)
    barcode_raw = str(product.barcode or "").strip()
    barcode_normalized = normalize_barcode(barcode_raw)

    extra_barcodes = [
        (raw, normalize_barcode(raw))
        for raw in product.additional_barcodes
        if normalize_barcode(raw)
    ]
    extra_norms = [norm for _, norm in extra_barcodes]

    if barcode_normalized and barcode_normalized in extra_norms:
        raise ProductDuplicateError(
            f"Product {neworder_id}: primary barcode duplicates an additional barcode"
        )
    if len(extra_norms) != len(set(extra_norms)):
        raise ProductDuplicateError(
            f"Product {neworder_id}: duplicate values in additional_barcodes"
        )

    deactivated = _deactivate_conflicting_products(
        cur,
        neworder_id=neworder_id,
        name_normalized=name_normalized,
        barcode_normalized=barcode_normalized,
    )

    cur.execute(
        """
        insert into no_products (
          neworder_id, name, name_normalized, barcode, barcode_normalized,
          cost_no_tax, cost, price, is_serial,
          category_id, category_name, supplier_id, supplier_name,
          is_tax_free, is_stock, is_active, description, synced_at
        ) values (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s, now()
        )
        on conflict (neworder_id) do update set
          name = excluded.name,
          name_normalized = excluded.name_normalized,
          barcode = excluded.barcode,
          barcode_normalized = excluded.barcode_normalized,
          cost_no_tax = excluded.cost_no_tax,
          cost = excluded.cost,
          price = excluded.price,
          is_serial = excluded.is_serial,
          category_id = excluded.category_id,
          category_name = excluded.category_name,
          supplier_id = excluded.supplier_id,
          supplier_name = excluded.supplier_name,
          is_tax_free = excluded.is_tax_free,
          is_stock = excluded.is_stock,
          is_active = excluded.is_active,
          description = excluded.description,
          synced_at = now(),
          updated_at = now()
        returning id, (xmax = 0) as inserted
        """,
        (
            neworder_id,
            name,
            name_normalized,
            barcode_raw,
            barcode_normalized,
            product.cost_no_tax,
            product.cost,
            product.price,
            product.is_serial,
            str(product.category_id) if product.category_id else None,
            product.category_name,
            str(product.supplier_id) if product.supplier_id else None,
            product.supplier_name,
            product.is_tax_free,
            product.is_stock,
            product.is_active,
            product.description,
        ),
    )
    row = cur.fetchone()
    product_id = UUID(str(row["id"]))
    created = bool(row["inserted"])

    if extra_norms:
        _deactivate_conflicting_additional_barcodes(
            cur,
            product_id=product_id,
            barcodes=extra_norms,
        )
    _replace_additional_barcodes(
        cur,
        product_id=product_id,
        barcodes=extra_barcodes,
    )

    return ProductUpsertResult(
        product_id=product_id,
        created=created,
        deactivated_conflicts=deactivated,
    )


def upsert_products_batch(products: list[ProductUpsertInput]) -> dict[str, int]:
    """Upsert many products in one transaction. Skips invalid rows, raises on hard duplicates."""
    if not products:
        return {"upserted": 0, "created": 0, "deactivated_conflicts": 0, "skipped": 0}

    stats = {"upserted": 0, "created": 0, "deactivated_conflicts": 0, "skipped": 0}
    seen_names: set[str] = set()
    seen_barcodes: set[str] = set()

    with db_connection() as conn:
        with conn.cursor() as cur:
            for product in products:
                name_key = normalize_product_name(product.name)
                barcode_key = normalize_barcode(product.barcode)

                if name_key and name_key in seen_names:
                    stats["skipped"] += 1
                    continue
                if barcode_key and barcode_key in seen_barcodes:
                    stats["skipped"] += 1
                    continue

                try:
                    result = upsert_product(cur, product)
                except ProductDuplicateError:
                    stats["skipped"] += 1
                    continue

                stats["upserted"] += 1
                if result.created:
                    stats["created"] += 1
                stats["deactivated_conflicts"] += result.deactivated_conflicts

                if name_key:
                    seen_names.add(name_key)
                if barcode_key:
                    seen_barcodes.add(barcode_key)

    return stats


def start_sync_run(source: str = "neworder_api") -> UUID:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into no_sync_runs (status, source)
                values ('running', %s)
                returning id
                """,
                (source,),
            )
            return UUID(str(cur.fetchone()["id"]))


def finish_sync_run(
    run_id: UUID,
    *,
    status: str,
    products_upserted: int = 0,
    documents_upserted: int = 0,
    line_items_upserted: int = 0,
    error_message: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update no_sync_runs
                set finished_at = %s,
                    status = %s,
                    products_upserted = %s,
                    documents_upserted = %s,
                    line_items_upserted = %s,
                    error_message = %s,
                    details = coalesce(%s, details)
                where id = %s::uuid
                """,
                (
                    datetime.now(timezone.utc),
                    status,
                    products_upserted,
                    documents_upserted,
                    line_items_upserted,
                    error_message,
                    Json(details) if details is not None else None,
                    str(run_id),
                ),
            )


def get_last_sync_run() -> dict[str, Any] | None:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, started_at, finished_at, status, products_upserted,
                       documents_upserted, line_items_upserted, error_message
                from no_sync_runs
                order by started_at desc
                limit 1
                """
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_neworder_config_status() -> dict[str, bool]:
    return {
        "database_configured": is_db_configured(),
        "neworder_token_configured": bool(__import__("os").environ.get("NEWORDER_API_TOKEN", "").strip()),
    }


def upsert_branch(cur: Any, row: dict[str, Any]) -> UUID:
    neworder_id = str(row.get("branchId") or row.get("id") or "").strip()
    if not neworder_id:
        raise ValueError("branch neworder_id is required")
    cur.execute(
        """
        insert into no_branches (
          neworder_id, company_name, branch_name, tax_id, address, phone_number,
          is_active, synced_at
        ) values (%s, %s, %s, %s, %s, %s, true, now())
        on conflict (neworder_id) do update set
          company_name = excluded.company_name,
          branch_name = excluded.branch_name,
          tax_id = excluded.tax_id,
          address = excluded.address,
          phone_number = excluded.phone_number,
          is_active = true,
          synced_at = now(),
          updated_at = now()
        returning id
        """,
        (
            neworder_id,
            row.get("companyName"),
            str(row.get("branchName") or ""),
            row.get("taxId"),
            row.get("address"),
            row.get("phoneNumber"),
        ),
    )
    return UUID(str(cur.fetchone()["id"]))


def upsert_category(cur: Any, row: dict[str, Any]) -> UUID:
    neworder_id = str(row.get("id") or "").strip()
    name = str(row.get("name") or "").strip()
    if not neworder_id or not name:
        raise ValueError("category id and name are required")
    name_normalized = normalize_product_name(name)
    cur.execute(
        """
        insert into no_categories (neworder_id, name, name_normalized, is_active, synced_at)
        values (%s, %s, %s, true, now())
        on conflict (neworder_id) do update set
          name = excluded.name,
          name_normalized = excluded.name_normalized,
          is_active = true,
          synced_at = now(),
          updated_at = now()
        returning id
        """,
        (neworder_id, name, name_normalized),
    )
    return UUID(str(cur.fetchone()["id"]))


def upsert_supplier(cur: Any, row: dict[str, Any]) -> UUID:
    neworder_id = str(row.get("id") or "").strip()
    name = str(row.get("name") or "").strip()
    if not neworder_id or not name:
        raise ValueError("supplier id and name are required")
    cur.execute(
        """
        insert into no_suppliers (neworder_id, name, phone_number, is_active, synced_at)
        values (%s, %s, %s, true, now())
        on conflict (neworder_id) do update set
          name = excluded.name,
          phone_number = excluded.phone_number,
          is_active = true,
          synced_at = now(),
          updated_at = now()
        returning id
        """,
        (neworder_id, name, row.get("phoneNumber")),
    )
    return UUID(str(cur.fetchone()["id"]))


def upsert_product_stock(
    cur: Any,
    *,
    product_id: UUID,
    branch_id: UUID,
    quantity: float,
) -> None:
    cur.execute(
        """
        insert into no_product_stock (product_id, branch_id, quantity, synced_at, updated_at)
        values (%s::uuid, %s::uuid, %s, now(), now())
        on conflict (product_id, branch_id) do update set
          quantity = excluded.quantity,
          synced_at = now(),
          updated_at = now()
        """,
        (str(product_id), str(branch_id), quantity),
    )


def lookup_product_id(cur: Any, neworder_product_id: str | None) -> UUID | None:
    if not neworder_product_id:
        return None
    cur.execute(
        "select id from no_products where neworder_id = %s limit 1",
        (str(neworder_product_id),),
    )
    row = cur.fetchone()
    return UUID(str(row["id"])) if row else None


def lookup_branch_uuid(cur: Any, neworder_branch_id: str | None) -> UUID | None:
    if not neworder_branch_id:
        return None
    cur.execute(
        "select id from no_branches where neworder_id = %s limit 1",
        (str(neworder_branch_id),),
    )
    row = cur.fetchone()
    return UUID(str(row["id"])) if row else None


def lookup_customer_uuid(cur: Any, neworder_customer_id: str | None) -> UUID | None:
    if not neworder_customer_id:
        return None
    cur.execute(
        "select id from no_customers where neworder_id = %s limit 1",
        (str(neworder_customer_id),),
    )
    row = cur.fetchone()
    return UUID(str(row["id"])) if row else None


def upsert_customer(cur: Any, row: dict[str, Any]) -> UUID:
    neworder_id = str(row.get("id") or "").strip()
    name = str(row.get("name") or "").strip()
    if not neworder_id or not name:
        raise ValueError("customer id and name are required")
    contact = row.get("contactDetails") or {}
    if not isinstance(contact, dict):
        contact = {}
    cur.execute(
        """
        insert into no_customers (
          neworder_id, name, tax_id, contact_person, balance,
          phone_number1, phone_number2, email, address, city, zipcode,
          join_date, last_purchase, is_active, synced_at
        ) values (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s,
          %s, %s, true, now()
        )
        on conflict (neworder_id) do update set
          name = excluded.name,
          tax_id = excluded.tax_id,
          contact_person = excluded.contact_person,
          balance = excluded.balance,
          phone_number1 = excluded.phone_number1,
          phone_number2 = excluded.phone_number2,
          email = excluded.email,
          address = excluded.address,
          city = excluded.city,
          zipcode = excluded.zipcode,
          join_date = excluded.join_date,
          last_purchase = excluded.last_purchase,
          is_active = true,
          synced_at = now(),
          updated_at = now()
        returning id
        """,
        (
            neworder_id,
            name,
            row.get("taxId"),
            row.get("contactPerson"),
            row.get("balance"),
            contact.get("phoneNumber1"),
            contact.get("phoneNumber2"),
            contact.get("email"),
            contact.get("address"),
            contact.get("city"),
            contact.get("zipcode"),
            _parse_date(row.get("joinDate")),
            _parse_date(row.get("lastPurchase")),
        ),
    )
    return UUID(str(cur.fetchone()["id"]))


def upsert_document(cur: Any, row: dict[str, Any]) -> UUID:
    neworder_id = str(row.get("id") or "").strip()
    if not neworder_id:
        raise ValueError("document id is required")

    paid = row.get("paidValues") or {}
    if not isinstance(paid, dict):
        paid = {}

    customer = row.get("customer")
    customer_neworder_id = None
    if isinstance(customer, dict):
        customer_neworder_id = customer.get("id")
    elif customer is not None:
        customer_neworder_id = customer

    branch_uuid = lookup_branch_uuid(cur, row.get("branchId"))
    customer_uuid = lookup_customer_uuid(cur, customer_neworder_id)

    cur.execute(
        """
        insert into no_documents (
          neworder_id, document_number, document_type, bill_number, create_date,
          employee_name, branch_id, customer_id, total_bill,
          paid_cash, paid_credit_card, paid_checks, paid_bank_transfer, paid_akafa,
          raw_paid_values, synced_at
        ) values (
          %s, %s, %s, %s, %s,
          %s, %s::uuid, %s::uuid, %s,
          %s, %s, %s, %s, %s,
          %s, now()
        )
        on conflict (neworder_id) do update set
          document_number = excluded.document_number,
          document_type = excluded.document_type,
          bill_number = excluded.bill_number,
          create_date = excluded.create_date,
          employee_name = excluded.employee_name,
          branch_id = excluded.branch_id,
          customer_id = excluded.customer_id,
          total_bill = excluded.total_bill,
          paid_cash = excluded.paid_cash,
          paid_credit_card = excluded.paid_credit_card,
          paid_checks = excluded.paid_checks,
          paid_bank_transfer = excluded.paid_bank_transfer,
          paid_akafa = excluded.paid_akafa,
          raw_paid_values = excluded.raw_paid_values,
          synced_at = now(),
          updated_at = now()
        returning id
        """,
        (
            neworder_id,
            row.get("documentNumber"),
            row.get("documentType"),
            row.get("billNumber"),
            _parse_datetime(row.get("createDate")),
            row.get("employee"),
            str(branch_uuid) if branch_uuid else None,
            str(customer_uuid) if customer_uuid else None,
            _num(row.get("totalBill")) or 0,
            _num(paid.get("cash")) or 0,
            _num(paid.get("creditCard")) or 0,
            _num(paid.get("checks")) or 0,
            _num(paid.get("bankTransfer")) or 0,
            _num(paid.get("akafa")) or 0,
            Json(paid),
        ),
    )
    return UUID(str(cur.fetchone()["id"]))


def replace_document_line_items(
    cur: Any,
    *,
    document_id: UUID,
    items: list[dict[str, Any]],
) -> int:
    cur.execute(
        "delete from no_document_line_items where document_id = %s::uuid",
        (str(document_id),),
    )
    count = 0
    for sort_order, row in enumerate(items):
        neworder_product_id = row.get("id")
        if neworder_product_id is not None:
            neworder_product_id = str(neworder_product_id)
        product_uuid = lookup_product_id(cur, neworder_product_id)
        quantity = _num(row.get("quantity")) or 0
        price = _num(row.get("price"))
        cost = _num(row.get("cost"))
        line_revenue = price * quantity if price is not None else 0
        line_cost = cost * quantity if cost is not None else 0
        cur.execute(
            """
            insert into no_document_line_items (
              document_id, neworder_product_id, product_id, sort_order, item_name,
              quantity, price, cost, line_revenue, line_cost, stock_after_operation, synced_at
            ) values (
              %s::uuid, %s, %s::uuid, %s, %s,
              %s, %s, %s, %s, %s, %s, now()
            )
            """,
            (
                str(document_id),
                neworder_product_id or "",
                str(product_uuid) if product_uuid else None,
                sort_order,
                str(row.get("name") or "Unknown item"),
                quantity,
                price,
                cost,
                line_revenue,
                line_cost,
                _num(row.get("storeCurrentStock")),
            ),
        )
        count += 1
    return count


def upsert_employee(cur: Any, row: dict[str, Any]) -> UUID:
    neworder_id = str(row.get("id") or "").strip()
    name = str(row.get("name") or "").strip()
    if not neworder_id or not name:
        raise ValueError("employee id and name are required")
    cur.execute(
        """
        insert into no_employees (
          neworder_id, name, phone_number, branch_info, shift_info, is_active, synced_at
        ) values (%s, %s, %s, %s, %s, true, now())
        on conflict (neworder_id) do update set
          name = excluded.name,
          phone_number = excluded.phone_number,
          branch_info = excluded.branch_info,
          shift_info = excluded.shift_info,
          is_active = true,
          synced_at = now(),
          updated_at = now()
        returning id
        """,
        (
            neworder_id,
            name,
            row.get("phoneNumber"),
            Json(row.get("branchInfo") or {}),
            Json(row.get("shiftInfo") or {}),
        ),
    )
    return UUID(str(cur.fetchone()["id"]))


def upsert_employee_attendance(cur: Any, row: dict[str, Any], *, month: int, year: int) -> None:
    employee = row.get("employee")
    employee_neworder_id = None
    if isinstance(employee, dict):
        employee_neworder_id = employee.get("id")
    cur.execute(
        "select id from no_employees where neworder_id = %s limit 1",
        (str(employee_neworder_id),),
    )
    emp_row = cur.fetchone()
    if not emp_row:
        return
    employee_id = emp_row["id"]
    cur.execute(
        """
        insert into no_employee_attendance (
          employee_id, month, year, enter_date, enter_time, exit_date, exit_time,
          total_hours, remark, synced_at
        ) values (
          %s::uuid, %s, %s, %s, %s, %s, %s,
          %s, %s, now()
        )
        on conflict (employee_id, enter_date, enter_time) do update set
          exit_date = excluded.exit_date,
          exit_time = excluded.exit_time,
          total_hours = excluded.total_hours,
          remark = excluded.remark,
          synced_at = now()
        """,
        (
            str(employee_id),
            month,
            year,
            _parse_date(row.get("enterDate")),
            _parse_time(row.get("enterTime")),
            _parse_date(row.get("exitDate")),
            _parse_time(row.get("exitTime")),
            _num(row.get("totalHours")),
            row.get("remark"),
        ),
    )


def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _parse_time(value: Any) -> time | None:
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text, fmt).time()
        except ValueError:
            continue
    return None


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
    ):
        try:
            return datetime.strptime(text[:19] if "T" in text else text, fmt)
        except ValueError:
            continue
    parsed_date = _parse_date(text)
    return datetime.combine(parsed_date, datetime.min.time()) if parsed_date else None
