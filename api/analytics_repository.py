"""SQL access for product performance analytics."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from supabase_client import db_connection

PRODUCT_KEY_EXPR = "COALESCE(NULLIF(TRIM(merchant_sku), ''), TRIM(item_name))"


def _validate_uuid(value: str) -> str:
    return str(UUID(value))


def fetch_period_product_metrics(timeline_id: str) -> dict[str, Any] | None:
    """Aggregate per-product metrics for one timeline, with previous-period growth."""
    tid = _validate_uuid(timeline_id)

    sql = f"""
    WITH period_info AS (
      SELECT
        t.id,
        t.period_label,
        t.period_start,
        t.period_end,
        GREATEST(
          1,
          COALESCE((t.period_end - t.period_start) + 1, 1)
        )::integer AS period_days
      FROM report_timelines t
      WHERE t.id = %s::uuid
    ),
    previous_timeline AS (
      SELECT pt.id
      FROM report_timelines pt
      CROSS JOIN period_info pi
      WHERE pi.period_start IS NOT NULL
        AND pi.period_end IS NOT NULL
        AND pt.period_start IS NOT NULL
        AND pt.period_end IS NOT NULL
        AND pt.period_end < pi.period_start
        AND (pt.period_end - pt.period_start) = (pi.period_end - pi.period_start)
      ORDER BY pt.period_end DESC
      LIMIT 1
    ),
    current_products AS (
      SELECT
        {PRODUCT_KEY_EXPR} AS product_key,
        MAX(item_name) AS item_name,
        MAX(NULLIF(TRIM(merchant_sku), '')) AS merchant_sku,
        SUM(quantity)::bigint AS total_quantity,
        ROUND(SUM(COALESCE(sold_total, gross_total, 0))::numeric, 2) AS total_revenue,
        ROUND(
          SUM(CASE WHEN status = 'ok' THEN net_income ELSE 0 END)::numeric,
          2
        ) AS total_net_profit,
        BOOL_OR(status = 'ok') AS has_profit_data
      FROM report_product_rows
      WHERE timeline_id = %s::uuid
      GROUP BY product_key
    ),
    previous_products AS (
      SELECT
        {PRODUCT_KEY_EXPR} AS product_key,
        SUM(quantity)::bigint AS previous_quantity,
        ROUND(SUM(COALESCE(sold_total, gross_total, 0))::numeric, 2) AS previous_revenue,
        ROUND(
          SUM(CASE WHEN status = 'ok' THEN net_income ELSE 0 END)::numeric,
          2
        ) AS previous_net_profit
      FROM report_product_rows
      WHERE timeline_id = (SELECT id FROM previous_timeline)
      GROUP BY product_key
    )
    SELECT
      pi.id AS timeline_id,
      pi.period_label,
      pi.period_start,
      pi.period_end,
      pi.period_days,
      (SELECT id FROM previous_timeline) AS previous_timeline_id,
      cp.product_key,
      cp.item_name,
      cp.merchant_sku,
      cp.total_quantity,
      cp.total_revenue,
      cp.total_net_profit,
      cp.has_profit_data,
      ROUND((cp.total_quantity::numeric / pi.period_days), 4) AS sales_velocity,
      pp.previous_quantity,
      pp.previous_revenue,
      pp.previous_net_profit,
      CASE
        WHEN pp.previous_quantity IS NOT NULL AND pp.previous_quantity > 0
        THEN ROUND(
          ((cp.total_quantity - pp.previous_quantity)::numeric / pp.previous_quantity) * 100,
          2
        )
        ELSE NULL
      END AS growth_quantity_pct,
      CASE
        WHEN pp.previous_revenue IS NOT NULL AND pp.previous_revenue > 0
        THEN ROUND(
          ((cp.total_revenue - pp.previous_revenue)::numeric / pp.previous_revenue) * 100,
          2
        )
        ELSE NULL
      END AS growth_revenue_pct,
      CASE
        WHEN pp.previous_net_profit IS NOT NULL AND pp.previous_net_profit <> 0
        THEN ROUND(
          ((cp.total_net_profit - pp.previous_net_profit)::numeric
            / ABS(pp.previous_net_profit)) * 100,
          2
        )
        ELSE NULL
      END AS growth_profit_pct
    FROM current_products cp
    CROSS JOIN period_info pi
    LEFT JOIN previous_products pp ON pp.product_key = cp.product_key
    ORDER BY cp.total_revenue DESC NULLS LAST, cp.product_key
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, period_label, period_start, period_end
                FROM report_timelines WHERE id = %s::uuid
                """,
                (tid,),
            )
            timeline_row = cur.fetchone()
            if not timeline_row:
                return None

            cur.execute(sql, (tid, tid))
            product_rows = cur.fetchall()

            cur.execute(
                """
                SELECT GREATEST(
                  1,
                  COALESCE((period_end - period_start) + 1, 1)
                )::integer AS period_days
                FROM report_timelines WHERE id = %s::uuid
                """,
                (tid,),
            )
            period_days_row = cur.fetchone()

    period_days = int(period_days_row["period_days"]) if period_days_row else 1
    previous_timeline_id = None
    if product_rows and product_rows[0].get("previous_timeline_id"):
        previous_timeline_id = str(product_rows[0]["previous_timeline_id"])

    return {
        "timeline": {
            "id": str(timeline_row["id"]),
            "period_label": timeline_row["period_label"],
            "period_start": (
                timeline_row["period_start"].isoformat()
                if timeline_row["period_start"]
                else None
            ),
            "period_end": (
                timeline_row["period_end"].isoformat()
                if timeline_row["period_end"]
                else None
            ),
        },
        "products": [_serialize_period_row(row) for row in product_rows],
        "previous_timeline_id": previous_timeline_id,
        "period_days": period_days,
    }


def fetch_overall_product_metrics() -> list[dict[str, Any]]:
    """Lifetime per-product metrics across all saved timelines."""

    sql = f"""
    WITH product_sales AS (
      SELECT
        {PRODUCT_KEY_EXPR} AS product_key,
        MAX(item_name) AS item_name,
        MAX(NULLIF(TRIM(merchant_sku), '')) AS merchant_sku,
        SUM(quantity)::bigint AS lifetime_quantity,
        ROUND(SUM(COALESCE(sold_total, gross_total, 0))::numeric, 2) AS lifetime_revenue,
        ROUND(
          SUM(CASE WHEN status = 'ok' THEN net_income ELSE 0 END)::numeric,
          2
        ) AS lifetime_profit,
        BOOL_OR(status = 'ok') AS has_profit_data
      FROM report_product_rows
      GROUP BY product_key
    ),
    order_penetration AS (
      SELECT
        {PRODUCT_KEY_EXPR} AS product_key,
        COUNT(DISTINCT o.id)::bigint AS orders_with_product
      FROM report_order_line_items li
      JOIN report_orders o ON o.id = li.order_id
      GROUP BY product_key
    ),
    total_orders AS (
      SELECT COUNT(DISTINCT id)::bigint AS total_order_count
      FROM report_orders
    ),
    consistency AS (
      SELECT
        {PRODUCT_KEY_EXPR} AS product_key,
        COUNT(DISTINCT date_trunc('month', t.period_start))::integer AS consistency_score
      FROM report_product_rows r
      JOIN report_timelines t ON t.id = r.timeline_id
      WHERE r.quantity > 0
        AND t.period_start IS NOT NULL
      GROUP BY product_key
    )
    SELECT
      ps.product_key,
      ps.item_name,
      ps.merchant_sku,
      ps.lifetime_quantity,
      ps.lifetime_revenue,
      ps.lifetime_profit,
      ps.has_profit_data,
      op.orders_with_product,
      tot.total_order_count,
      CASE
        WHEN tot.total_order_count > 0
        THEN ROUND(
          (op.orders_with_product::numeric / tot.total_order_count) * 100,
          2
        )
        ELSE 0
      END AS order_penetration_pct,
      COALESCE(c.consistency_score, 0) AS consistency_score
    FROM product_sales ps
    LEFT JOIN order_penetration op ON op.product_key = ps.product_key
    CROSS JOIN total_orders tot
    LEFT JOIN consistency c ON c.product_key = ps.product_key
    ORDER BY ps.lifetime_revenue DESC NULLS LAST, ps.product_key
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    return [_serialize_overall_row(row) for row in rows]


def _serialize_period_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "product_key": row["product_key"],
        "item_name": row["item_name"],
        "merchant_sku": row["merchant_sku"] or "",
        "total_quantity": int(row["total_quantity"] or 0),
        "total_revenue": float(row["total_revenue"] or 0),
        "total_net_profit": float(row["total_net_profit"] or 0),
        "has_profit_data": bool(row["has_profit_data"]),
        "sales_velocity": float(row["sales_velocity"] or 0),
        "growth_quantity_pct": _optional_float(row.get("growth_quantity_pct")),
        "growth_revenue_pct": _optional_float(row.get("growth_revenue_pct")),
        "growth_profit_pct": _optional_float(row.get("growth_profit_pct")),
        "previous_quantity": (
            int(row["previous_quantity"]) if row.get("previous_quantity") is not None else None
        ),
        "previous_revenue": _optional_float(row.get("previous_revenue")),
        "previous_net_profit": _optional_float(row.get("previous_net_profit")),
    }


def _serialize_overall_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "product_key": row["product_key"],
        "item_name": row["item_name"],
        "merchant_sku": row["merchant_sku"] or "",
        "lifetime_quantity": int(row["lifetime_quantity"] or 0),
        "lifetime_revenue": float(row["lifetime_revenue"] or 0),
        "lifetime_profit": float(row["lifetime_profit"] or 0),
        "has_profit_data": bool(row["has_profit_data"]),
        "orders_with_product": int(row["orders_with_product"] or 0),
        "total_order_count": int(row["total_order_count"] or 0),
        "order_penetration_pct": float(row["order_penetration_pct"] or 0),
        "consistency_score": int(row["consistency_score"] or 0),
    }


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)
