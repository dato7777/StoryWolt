"""Product performance analytics — rankings and API response shaping."""

from __future__ import annotations

from typing import Any

from analytics_repository import fetch_overall_product_metrics, fetch_period_product_metrics

PERIOD_SORT_FIELDS = frozenset({
    "total_quantity",
    "total_revenue",
    "total_net_profit",
    "sales_velocity",
    "growth_quantity_pct",
    "growth_revenue_pct",
    "growth_profit_pct",
    "product_key",
    "item_name",
})

OVERALL_SORT_FIELDS = frozenset({
    "lifetime_quantity",
    "lifetime_revenue",
    "lifetime_profit",
    "order_penetration_pct",
    "consistency_score",
    "product_key",
    "item_name",
})

PERIOD_RANKINGS = frozenset({
    "top_quantity",
    "top_revenue",
    "top_profit",
    "fastest_growing",
})

OVERALL_RANKINGS = frozenset({
    "top_profit",
    "top_revenue",
    "top_quantity",
    "top_penetration",
    "most_consistent",
})

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def parse_limit(raw: str | None) -> int:
    if not raw:
        return DEFAULT_LIMIT
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_LIMIT
    return max(1, min(value, MAX_LIMIT))


def parse_sort_field(raw: str | None, allowed: frozenset[str], default: str) -> str:
    if raw and raw in allowed:
        return raw
    return default


def sort_products(
    products: list[dict[str, Any]],
    sort_field: str,
    *,
    descending: bool = True,
) -> list[dict[str, Any]]:
    """Return a new list sorted by metric (nulls last)."""

    def sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
        value = item.get(sort_field)
        if value is None:
            return (1, 0, item.get("product_key", ""))
        if isinstance(value, str):
            return (0, value.lower() if not descending else value.lower(), item.get("product_key", ""))
        numeric = -value if descending else value
        return (0, numeric, item.get("product_key", ""))

    return sorted(products, key=sort_key)


def take_top(products: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    return products[:limit]


def build_period_rankings(products: list[dict[str, Any]], limit: int) -> dict[str, list[dict[str, Any]]]:
    growing = [
        p
        for p in products
        if p.get("growth_revenue_pct") is not None
    ]
    growing_sorted = sorted(
        growing,
        key=lambda p: (p["growth_revenue_pct"], p["total_revenue"]),
        reverse=True,
    )

    return {
        "top_quantity": take_top(sort_products(products, "total_quantity"), limit),
        "top_revenue": take_top(sort_products(products, "total_revenue"), limit),
        "top_profit": take_top(sort_products(products, "total_net_profit"), limit),
        "fastest_growing": take_top(growing_sorted, limit),
    }


def build_overall_rankings(products: list[dict[str, Any]], limit: int) -> dict[str, list[dict[str, Any]]]:
    return {
        "top_profit": take_top(sort_products(products, "lifetime_profit"), limit),
        "top_revenue": take_top(sort_products(products, "lifetime_revenue"), limit),
        "top_quantity": take_top(sort_products(products, "lifetime_quantity"), limit),
        "top_penetration": take_top(sort_products(products, "order_penetration_pct"), limit),
        "most_consistent": take_top(sort_products(products, "consistency_score"), limit),
    }


def get_period_analytics(
    timeline_id: str,
    *,
    sort: str | None = None,
    limit: int = DEFAULT_LIMIT,
    ranking: str | None = None,
) -> dict[str, Any]:
    raw = fetch_period_product_metrics(timeline_id)
    if raw is None:
        raise ValueError(f"Timeline not found: {timeline_id}")

    products = raw["products"]
    sort_field = parse_sort_field(sort, PERIOD_SORT_FIELDS, "total_revenue")
    sorted_products = sort_products(products, sort_field)
    rankings = build_period_rankings(products, limit)

    payload: dict[str, Any] = {
        "analysis_type": "period",
        "timeline": raw["timeline"],
        "period_days": raw["period_days"],
        "previous_timeline_id": raw["previous_timeline_id"],
        "product_count": len(products),
        "sort": sort_field,
        "limit": limit,
        "products": take_top(sorted_products, limit) if not ranking else [],
        "rankings": rankings,
    }

    if ranking:
        if ranking not in PERIOD_RANKINGS:
            raise ValueError(f"Invalid ranking. Allowed: {', '.join(sorted(PERIOD_RANKINGS))}")
        payload["products"] = rankings[ranking]

    return payload


def get_overall_analytics(
    *,
    sort: str | None = None,
    limit: int = DEFAULT_LIMIT,
    ranking: str | None = None,
) -> dict[str, Any]:
    products = fetch_overall_product_metrics()
    sort_field = parse_sort_field(sort, OVERALL_SORT_FIELDS, "lifetime_revenue")
    sorted_products = sort_products(products, sort_field)
    rankings = build_overall_rankings(products, limit)

    payload: dict[str, Any] = {
        "analysis_type": "overall",
        "timeline_count": _distinct_timeline_count(),
        "product_count": len(products),
        "sort": sort_field,
        "limit": limit,
        "products": take_top(sorted_products, limit) if not ranking else [],
        "rankings": rankings,
    }

    if ranking:
        if ranking not in OVERALL_RANKINGS:
            raise ValueError(f"Invalid ranking. Allowed: {', '.join(sorted(OVERALL_RANKINGS))}")
        payload["products"] = rankings[ranking]

    return payload


def _distinct_timeline_count() -> int:
    from supabase_client import db_connection

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*)::integer AS c FROM report_timelines")
            row = cur.fetchone()
    return int(row["c"] if row else 0)
