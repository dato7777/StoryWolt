"""Persist and load dashboard timelines + commission catalog in PostgreSQL."""

from __future__ import annotations

import json
from datetime import date
from typing import Any
from uuid import UUID

from psycopg2.extras import execute_values

from commission_engine import CommissionOffer, normalize_product_name
from supabase_client import db_connection, is_db_configured


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _num(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    return int(value)


# ---------------------------------------------------------------------------
# Commission catalog
# ---------------------------------------------------------------------------


def import_commission_offers(
    offers: list[dict[str, Any]],
    *,
    source_label: str = "offers_commission.xlsx",
    notes: str | None = None,
) -> str:
    """Replace active commission catalog with a new version. Returns version id."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update commission_catalog_versions set is_active = false where is_active = true"
            )
            cur.execute(
                """
                insert into commission_catalog_versions (source_label, notes, row_count, is_active)
                values (%s, %s, %s, true)
                returning id
                """,
                (source_label, notes, len(offers)),
            )
            version_id = str(cur.fetchone()["id"])

            if offers:
                cur.executemany(
                    """
                    insert into commission_offers (
                      catalog_version_id, merchant_sku, product_name, list_price,
                      commission_home_delivery, commission_takeaway, product_self_cost
                    ) values (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            version_id,
                            str(row.get("merchant_sku") or ""),
                            str(row["product_name"]),
                            row.get("list_price"),
                            row.get("commission_home_delivery"),
                            row.get("commission_takeaway"),
                            row.get("product_self_cost") or 0,
                        )
                        for row in offers
                    ],
                )

    return version_id


def get_active_catalog_version_id() -> str | None:
    if not is_db_configured():
        return None
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id from commission_catalog_versions
                where is_active = true
                order by created_at desc
                limit 1
                """
            )
            row = cur.fetchone()
    return str(row["id"]) if row else None


def load_active_commission_offers() -> dict[str, CommissionOffer]:
    """Load active catalog as normalized-name → CommissionOffer dict."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select o.merchant_sku, o.product_name, o.list_price,
                       o.commission_home_delivery, o.product_self_cost
                from commission_offers o
                join commission_catalog_versions v on v.id = o.catalog_version_id
                where v.is_active = true
                """
            )
            rows = cur.fetchall()

    offers: dict[str, CommissionOffer] = {}
    for row in rows:
        name = str(row["product_name"]).strip()
        offers[normalize_product_name(name)] = CommissionOffer(
            merchant_sku=str(row["merchant_sku"] or ""),
            name=name,
            price=_num(row["list_price"]),
            commission_percent=_num(row["commission_home_delivery"]),
            self_cost=round(float(row["product_self_cost"] or 0), 2),
        )
    return offers


def offers_from_xlsx_rows(offers_by_name: dict[str, CommissionOffer]) -> list[dict[str, Any]]:
    return [
        {
            "merchant_sku": offer.merchant_sku,
            "product_name": offer.name,
            "list_price": offer.price,
            "commission_home_delivery": offer.commission_percent,
            "commission_takeaway": None,
            "product_self_cost": offer.self_cost,
        }
        for offer in offers_by_name.values()
    ]


# ---------------------------------------------------------------------------
# Report timelines
# ---------------------------------------------------------------------------


def save_report_timeline(
    result: dict[str, Any],
    *,
    catalog_version_id: str | None = None,
    order_numbers_file_name: str | None = None,
    payment_details_file_name: str | None = None,
) -> str:
    """Persist a full calculation response. Returns timeline id."""
    summary = result["summary"]
    period_label = (
        summary.get("report_period_label")
        or f"Report {_int(summary.get('delivered_order_count'))} orders"
    )

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into report_timelines (
                  period_label, period_start, period_end, catalog_version_id,
                  data_source, upload_format, rejected_excluded, warning, formula,
                  invoice_reconciliation, order_numbers_file_name, payment_details_file_name
                ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning id
                """,
                (
                    period_label,
                    _parse_date(summary.get("report_period_start")),
                    _parse_date(summary.get("report_period_end")),
                    catalog_version_id,
                    result.get("data_source", ""),
                    result.get("upload_format"),
                    bool(result.get("rejected_excluded", True)),
                    result.get("warning"),
                    json.dumps(result.get("formula") or {}),
                    json.dumps(result.get("invoice_reconciliation"))
                    if result.get("invoice_reconciliation")
                    else None,
                    order_numbers_file_name,
                    payment_details_file_name,
                ),
            )
            timeline_id = str(cur.fetchone()["id"])

            cur.execute(
                """
                insert into report_timeline_summaries (
                  timeline_id, row_count, matched_count, unmatched_count,
                  delivered_order_count, rejected_order_count, rejected_order_total,
                  total_gross, total_list_value, total_sold_value,
                  total_commission_before_vat, total_commission_with_vat, total_net_income,
                  total_product_self_cost,
                  wolt_summary_gross_goods, wolt_summary_expenses_net,
                  wolt_summary_expenses_incl_vat, wolt_summary_distribution_incl_vat,
                  wolt_summary_remunerations, wolt_summary_self_billing_deductions_incl_vat,
                  wolt_summary_self_billing_negative_incl_vat, wolt_summary_payout,
                  wolt_summary_net_income, wolt_summary_ad_campaigns_incl_vat,
                  wolt_summary_ad_campaigns_allocated_incl_vat, wolt_summary_other_fees_incl_vat,
                  wolt_summary_distribution_gap_incl_vat,
                  per_item_expenses_excluded_incl_vat, per_item_expenses_excluded_after_ads_incl_vat,
                  report_period_label, report_period_start, report_period_end
                ) values (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                  %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                )
                """,
                (
                    timeline_id,
                    _int(summary.get("row_count")),
                    _int(summary.get("matched_count")),
                    _int(summary.get("unmatched_count")),
                    _int(summary.get("delivered_order_count")),
                    _int(summary.get("rejected_order_count")),
                    _num(summary.get("rejected_order_total")) or 0,
                    _num(summary.get("total_gross")) or 0,
                    _num(summary.get("total_list_value")),
                    _num(summary.get("total_sold_value")),
                    _num(summary.get("total_commission_before_vat")) or 0,
                    _num(summary.get("total_commission_with_vat")) or 0,
                    _num(summary.get("total_net_income")) or 0,
                    _num(summary.get("total_product_self_cost")) or 0,
                    _num(summary.get("wolt_summary_gross_goods")),
                    _num(summary.get("wolt_summary_expenses_net")),
                    _num(summary.get("wolt_summary_expenses_incl_vat")),
                    _num(summary.get("wolt_summary_distribution_incl_vat")),
                    _num(summary.get("wolt_summary_remunerations")),
                    _num(summary.get("wolt_summary_self_billing_deductions_incl_vat")),
                    _num(summary.get("wolt_summary_self_billing_negative_incl_vat")),
                    _num(summary.get("wolt_summary_payout")),
                    _num(summary.get("wolt_summary_net_income")),
                    _num(summary.get("wolt_summary_ad_campaigns_incl_vat")),
                    _num(summary.get("wolt_summary_ad_campaigns_allocated_incl_vat")),
                    _num(summary.get("wolt_summary_other_fees_incl_vat")),
                    _num(summary.get("wolt_summary_distribution_gap_incl_vat")),
                    _num(summary.get("per_item_expenses_excluded_incl_vat")),
                    _num(summary.get("per_item_expenses_excluded_after_ads_incl_vat")),
                    summary.get("report_period_label"),
                    _parse_date(summary.get("report_period_start")),
                    _parse_date(summary.get("report_period_end")),
                ),
            )

            product_rows = [
                _product_row_params(timeline_id, idx, row)
                for idx, row in enumerate(result.get("rows") or [])
            ]
            if product_rows:
                execute_values(
                    cur,
                    """
                    insert into report_product_rows (
                      timeline_id, sort_order, item_name, merchant_sku, quantity,
                      list_price, list_total, sold_total, gross_total,
                      commission_percent, commission_before_vat, commission_with_vat,
                      commission_with_vat_per_item, product_self_cost, net_income,
                      net_income_per_item, allocated_ad_cost, net_income_after_ad_cost,
                      net_income_after_ad_cost_per_item, status, match_method
                    ) values %s
                    """,
                    product_rows,
                    page_size=500,
                )

            orders = result.get("orders") or []
            order_id_by_sort: dict[int, str] = {}
            if orders:
                order_params = [
                    (
                        timeline_id,
                        idx,
                        order.get("order_number", ""),
                        order.get("order_placed", ""),
                        order.get("delivery_time", ""),
                        order.get("delivery_status", ""),
                        _num(order.get("order_gross")) or 0,
                        _num(order.get("commission_before_vat")) or 0,
                        _num(order.get("commission_with_vat")) or 0,
                        _num(order.get("net_income")) or 0,
                        _num(order.get("allocated_ad_cost")) or 0,
                        _num(order.get("net_income_after_ad_cost")) or 0,
                    )
                    for idx, order in enumerate(orders)
                ]
                inserted_orders = execute_values(
                    cur,
                    """
                    insert into report_orders (
                      timeline_id, sort_order, order_number, order_placed, delivery_time,
                      delivery_status, order_gross, commission_before_vat, commission_with_vat,
                      net_income, allocated_ad_cost, net_income_after_ad_cost
                    ) values %s
                    returning id, sort_order
                    """,
                    order_params,
                    page_size=200,
                    fetch=True,
                )
                order_id_by_sort = {
                    int(row["sort_order"]): str(row["id"]) for row in inserted_orders
                }

            line_item_rows: list[tuple[Any, ...]] = []
            for idx, order in enumerate(orders):
                order_db_id = order_id_by_sort.get(idx)
                if not order_db_id:
                    continue
                for line_idx, item in enumerate(order.get("items") or []):
                    line_item_rows.append(_line_item_params(order_db_id, line_idx, item))

            if line_item_rows:
                execute_values(
                    cur,
                    """
                    insert into report_order_line_items (
                      order_id, sort_order, item_name, merchant_sku, quantity, line_gross,
                      list_price, commission_percent, commission_before_vat, commission_with_vat,
                      commission_with_vat_per_item, product_self_cost, net_income,
                      net_income_per_item, allocated_ad_cost, net_income_after_ad_cost,
                      net_income_after_ad_cost_per_item, status, match_method
                    ) values %s
                    """,
                    line_item_rows,
                    page_size=500,
                )

            missing_rows = [
                (
                    timeline_id,
                    idx,
                    product.get("item_name", ""),
                    product.get("merchant_sku", ""),
                    _int(product.get("quantity")),
                    _num(product.get("sold_total")) or 0,
                    product.get("status", "missing_commission"),
                    product.get("match_method", ""),
                )
                for idx, product in enumerate(result.get("missing_commission_products") or [])
            ]
            if missing_rows:
                execute_values(
                    cur,
                    """
                    insert into report_missing_commission_products (
                      timeline_id, sort_order, item_name, merchant_sku, quantity,
                      sold_total, status, match_method
                    ) values %s
                    """,
                    missing_rows,
                    page_size=500,
                )

    return timeline_id


def _product_row_params(timeline_id: str, idx: int, row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        timeline_id,
        idx,
        row.get("item_name", ""),
        row.get("merchant_sku", ""),
        _int(row.get("quantity")),
        _num(row.get("list_price")),
        _num(row.get("list_total")),
        _num(row.get("sold_total")),
        _num(row.get("gross_total")) or 0,
        _num(row.get("commission_percent")),
        _num(row.get("commission_before_vat")) or 0,
        _num(row.get("commission_with_vat")) or 0,
        _num(row.get("commission_with_vat_per_item")),
        _num(row.get("product_self_cost")) or 0,
        _num(row.get("net_income")) or 0,
        _num(row.get("net_income_per_item")) or 0,
        _num(row.get("allocated_ad_cost")) or 0,
        _num(row.get("net_income_after_ad_cost")) or 0,
        _num(row.get("net_income_after_ad_cost_per_item")) or 0,
        row.get("status", "ok"),
        row.get("match_method", ""),
    )


def _line_item_params(order_id: str, idx: int, item: dict[str, Any]) -> tuple[Any, ...]:
    return (
        order_id,
        idx,
        item.get("item_name", ""),
        item.get("merchant_sku", ""),
        _int(item.get("quantity")),
        _num(item.get("line_gross")) or 0,
        _num(item.get("list_price")),
        _num(item.get("commission_percent")),
        _num(item.get("commission_before_vat")) or 0,
        _num(item.get("commission_with_vat")) or 0,
        _num(item.get("commission_with_vat_per_item")),
        _num(item.get("product_self_cost")) or 0,
        _num(item.get("net_income")) or 0,
        _num(item.get("net_income_per_item")) or 0,
        _num(item.get("allocated_ad_cost")) or 0,
        _num(item.get("net_income_after_ad_cost")) or 0,
        _num(item.get("net_income_after_ad_cost_per_item")) or 0,
        item.get("status", "ok"),
        item.get("match_method", ""),
    )


def list_report_timelines() -> list[dict[str, Any]]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                  t.id,
                  t.created_at,
                  t.period_label,
                  t.period_start,
                  t.period_end,
                  s.delivered_order_count,
                  s.wolt_summary_net_income,
                  s.total_net_income,
                  s.wolt_summary_gross_goods,
                  s.wolt_summary_payout
                from report_timelines t
                join report_timeline_summaries s on s.timeline_id = t.id
                order by coalesce(t.period_start, t.created_at::date) desc, t.created_at desc
                """
            )
            rows = cur.fetchall()

    return [_timeline_list_item(row) for row in rows]


def _timeline_list_item(row: dict[str, Any]) -> dict[str, Any]:
    headline_net = row["wolt_summary_net_income"]
    if headline_net is None:
        headline_net = row["total_net_income"]
    return {
        "id": str(row["id"]),
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "period_label": row["period_label"],
        "period_start": row["period_start"].isoformat() if row["period_start"] else None,
        "period_end": row["period_end"].isoformat() if row["period_end"] else None,
        "delivered_order_count": _int(row["delivered_order_count"]),
        "headline_net_income": _num(headline_net),
        "has_wolt_summary": row["wolt_summary_gross_goods"] is not None,
        "wolt_payout": _num(row["wolt_summary_payout"]),
    }


def load_report_timeline(timeline_id: str) -> dict[str, Any]:
    UUID(timeline_id)  # validate

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select * from report_timelines where id = %s", (timeline_id,))
            timeline = cur.fetchone()
            if not timeline:
                raise ValueError(f"Timeline not found: {timeline_id}")

            cur.execute(
                "select * from report_timeline_summaries where timeline_id = %s",
                (timeline_id,),
            )
            summary_row = cur.fetchone()

            cur.execute(
                """
                select * from report_product_rows
                where timeline_id = %s order by sort_order
                """,
                (timeline_id,),
            )
            product_rows = cur.fetchall()

            cur.execute(
                """
                select * from report_orders
                where timeline_id = %s order by sort_order
                """,
                (timeline_id,),
            )
            orders = cur.fetchall()

            order_ids = [str(o["id"]) for o in orders]
            line_items_by_order: dict[str, list[dict[str, Any]]] = {oid: [] for oid in order_ids}
            if order_ids:
                cur.execute(
                    """
                    select * from report_order_line_items
                    where order_id = any(%s::uuid[])
                    order by sort_order
                    """,
                    (order_ids,),
                )
                for item in cur.fetchall():
                    line_items_by_order[str(item["order_id"])].append(item)

            cur.execute(
                """
                select * from report_missing_commission_products
                where timeline_id = %s order by sort_order
                """,
                (timeline_id,),
            )
            missing = cur.fetchall()

    return _build_calculation_response(timeline, summary_row, product_rows, orders, line_items_by_order, missing)


def _build_calculation_response(
    timeline: dict[str, Any],
    summary_row: dict[str, Any],
    product_rows: list[dict[str, Any]],
    orders: list[dict[str, Any]],
    line_items_by_order: dict[str, list[dict[str, Any]]],
    missing: list[dict[str, Any]],
) -> dict[str, Any]:
    summary = {
        "row_count": _int(summary_row["row_count"]),
        "matched_count": _int(summary_row["matched_count"]),
        "unmatched_count": _int(summary_row["unmatched_count"]),
        "delivered_order_count": _int(summary_row["delivered_order_count"]),
        "rejected_order_count": _int(summary_row["rejected_order_count"]),
        "rejected_order_total": _num(summary_row["rejected_order_total"]) or 0,
        "total_gross": _num(summary_row["total_gross"]) or 0,
        "total_list_value": _num(summary_row["total_list_value"]),
        "total_sold_value": _num(summary_row["total_sold_value"]),
        "total_commission_before_vat": _num(summary_row["total_commission_before_vat"]) or 0,
        "total_commission_with_vat": _num(summary_row["total_commission_with_vat"]) or 0,
        "total_net_income": _num(summary_row["total_net_income"]) or 0,
        "total_product_self_cost": _num(summary_row["total_product_self_cost"]) or 0,
        "wolt_summary_gross_goods": _num(summary_row["wolt_summary_gross_goods"]),
        "wolt_summary_expenses_net": _num(summary_row["wolt_summary_expenses_net"]),
        "wolt_summary_expenses_incl_vat": _num(summary_row["wolt_summary_expenses_incl_vat"]),
        "wolt_summary_distribution_incl_vat": _num(summary_row["wolt_summary_distribution_incl_vat"]),
        "wolt_summary_remunerations": _num(summary_row["wolt_summary_remunerations"]),
        "wolt_summary_self_billing_deductions_incl_vat": _num(
            summary_row["wolt_summary_self_billing_deductions_incl_vat"]
        ),
        "wolt_summary_self_billing_negative_incl_vat": _num(
            summary_row["wolt_summary_self_billing_negative_incl_vat"]
        ),
        "wolt_summary_payout": _num(summary_row["wolt_summary_payout"]),
        "wolt_summary_net_income": _num(summary_row["wolt_summary_net_income"]),
        "wolt_summary_ad_campaigns_incl_vat": _num(summary_row["wolt_summary_ad_campaigns_incl_vat"]),
        "wolt_summary_ad_campaigns_allocated_incl_vat": _num(
            summary_row["wolt_summary_ad_campaigns_allocated_incl_vat"]
        ),
        "wolt_summary_other_fees_incl_vat": _num(summary_row["wolt_summary_other_fees_incl_vat"]),
        "wolt_summary_distribution_gap_incl_vat": _num(
            summary_row["wolt_summary_distribution_gap_incl_vat"]
        ),
        "per_item_expenses_excluded_incl_vat": _num(summary_row["per_item_expenses_excluded_incl_vat"]),
        "per_item_expenses_excluded_after_ads_incl_vat": _num(
            summary_row["per_item_expenses_excluded_after_ads_incl_vat"]
        ),
        "report_period_label": summary_row.get("report_period_label"),
        "report_period_start": (
            summary_row["report_period_start"].isoformat()
            if summary_row.get("report_period_start")
            else None
        ),
        "report_period_end": (
            summary_row["report_period_end"].isoformat()
            if summary_row.get("report_period_end")
            else None
        ),
    }

    rows = [_product_row_to_dict(r) for r in product_rows]
    orders_out = [_order_to_dict(o, line_items_by_order.get(str(o["id"]), [])) for o in orders]

    invoice = timeline.get("invoice_reconciliation")
    if isinstance(invoice, str):
        invoice = json.loads(invoice)

    formula = timeline.get("formula")
    if isinstance(formula, str):
        formula = json.loads(formula)

    return {
        "timeline_id": str(timeline["id"]),
        "summary": summary,
        "rows": rows,
        "orders": orders_out,
        "missing_commission_products": [_missing_to_dict(m) for m in missing] or None,
        "invoice_reconciliation": invoice,
        "data_source": timeline.get("data_source", ""),
        "rejected_excluded": bool(timeline.get("rejected_excluded", True)),
        "warning": timeline.get("warning"),
        "upload_format": timeline.get("upload_format"),
        "formula": formula or {},
        "saved_at": timeline["created_at"].isoformat() if timeline.get("created_at") else None,
    }


def _product_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "item_name": row["item_name"],
        "merchant_sku": row["merchant_sku"],
        "quantity": _int(row["quantity"]),
        "list_price": _num(row["list_price"]),
        "list_total": _num(row["list_total"]),
        "sold_total": _num(row["sold_total"]),
        "gross_total": _num(row["gross_total"]) or 0,
        "commission_percent": _num(row["commission_percent"]),
        "commission_before_vat": _num(row["commission_before_vat"]) or 0,
        "commission_with_vat": _num(row["commission_with_vat"]) or 0,
        "commission_with_vat_per_item": _num(row["commission_with_vat_per_item"]),
        "product_self_cost": _num(row["product_self_cost"]) or 0,
        "net_income": _num(row["net_income"]) or 0,
        "net_income_per_item": _num(row["net_income_per_item"]) or 0,
        "allocated_ad_cost": _num(row["allocated_ad_cost"]) or 0,
        "net_income_after_ad_cost": _num(row["net_income_after_ad_cost"]) or 0,
        "net_income_after_ad_cost_per_item": _num(row["net_income_after_ad_cost_per_item"]) or 0,
        "status": row["status"],
        "match_method": row["match_method"],
    }


def _line_item_to_dict(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "item_name": item["item_name"],
        "merchant_sku": item["merchant_sku"],
        "quantity": _int(item["quantity"]),
        "line_gross": _num(item["line_gross"]) or 0,
        "list_price": _num(item["list_price"]),
        "commission_percent": _num(item["commission_percent"]),
        "commission_before_vat": _num(item["commission_before_vat"]) or 0,
        "commission_with_vat": _num(item["commission_with_vat"]) or 0,
        "commission_with_vat_per_item": _num(item["commission_with_vat_per_item"]),
        "product_self_cost": _num(item["product_self_cost"]) or 0,
        "net_income": _num(item["net_income"]) or 0,
        "net_income_per_item": _num(item["net_income_per_item"]) or 0,
        "allocated_ad_cost": _num(item["allocated_ad_cost"]) or 0,
        "net_income_after_ad_cost": _num(item["net_income_after_ad_cost"]) or 0,
        "net_income_after_ad_cost_per_item": _num(item["net_income_after_ad_cost_per_item"]) or 0,
        "status": item["status"],
        "match_method": item["match_method"],
    }


def _order_to_dict(order: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "order_number": order["order_number"],
        "order_placed": order["order_placed"],
        "delivery_time": order["delivery_time"],
        "delivery_status": order["delivery_status"],
        "order_gross": _num(order["order_gross"]) or 0,
        "commission_before_vat": _num(order["commission_before_vat"]) or 0,
        "commission_with_vat": _num(order["commission_with_vat"]) or 0,
        "net_income": _num(order["net_income"]) or 0,
        "allocated_ad_cost": _num(order["allocated_ad_cost"]) or 0,
        "net_income_after_ad_cost": _num(order["net_income_after_ad_cost"]) or 0,
        "items": [_line_item_to_dict(i) for i in items],
    }


def _missing_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "item_name": row["item_name"],
        "merchant_sku": row["merchant_sku"],
        "quantity": _int(row["quantity"]),
        "sold_total": _num(row["sold_total"]) or 0,
        "status": row["status"],
        "match_method": row["match_method"],
    }
