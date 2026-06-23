"""Unit tests for product analytics service layer."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(API_DIR))

from analytics_service import (  # noqa: E402
    build_overall_rankings,
    build_period_rankings,
    get_overall_analytics,
    get_period_analytics,
    parse_limit,
    sort_products,
)


SAMPLE_PERIOD_PRODUCTS = [
    {
        "product_key": "sku-a",
        "item_name": "Product A",
        "merchant_sku": "sku-a",
        "total_quantity": 10,
        "total_revenue": 500.0,
        "total_net_profit": 120.0,
        "has_profit_data": True,
        "sales_velocity": 0.67,
        "growth_revenue_pct": 25.0,
        "growth_quantity_pct": 10.0,
        "growth_profit_pct": 5.0,
    },
    {
        "product_key": "sku-b",
        "item_name": "Product B",
        "merchant_sku": "sku-b",
        "total_quantity": 30,
        "total_revenue": 300.0,
        "total_net_profit": 80.0,
        "has_profit_data": True,
        "sales_velocity": 2.0,
        "growth_revenue_pct": 50.0,
        "growth_quantity_pct": 40.0,
        "growth_profit_pct": 20.0,
    },
    {
        "product_key": "sku-c",
        "item_name": "Product C",
        "merchant_sku": "sku-c",
        "total_quantity": 5,
        "total_revenue": 900.0,
        "total_net_profit": 200.0,
        "has_profit_data": True,
        "sales_velocity": 0.33,
        "growth_revenue_pct": None,
        "growth_quantity_pct": None,
        "growth_profit_pct": None,
    },
]


class AnalyticsServiceTests(unittest.TestCase):
    def test_parse_limit_bounds(self) -> None:
        self.assertEqual(parse_limit(None), 20)
        self.assertEqual(parse_limit("5"), 5)
        self.assertEqual(parse_limit("0"), 1)
        self.assertEqual(parse_limit("999"), 100)
        self.assertEqual(parse_limit("bad"), 20)

    def test_sort_products_descending_numeric(self) -> None:
        sorted_rows = sort_products(SAMPLE_PERIOD_PRODUCTS, "total_revenue")
        self.assertEqual([row["product_key"] for row in sorted_rows], ["sku-c", "sku-a", "sku-b"])

    def test_build_period_rankings(self) -> None:
        rankings = build_period_rankings(SAMPLE_PERIOD_PRODUCTS, limit=2)
        self.assertEqual(rankings["top_quantity"][0]["product_key"], "sku-b")
        self.assertEqual(rankings["top_revenue"][0]["product_key"], "sku-c")
        self.assertEqual(rankings["top_profit"][0]["product_key"], "sku-c")
        self.assertEqual(rankings["fastest_growing"][0]["product_key"], "sku-b")
        self.assertEqual(len(rankings["fastest_growing"]), 2)

    def test_build_overall_rankings(self) -> None:
        overall = [
            {
                "product_key": "a",
                "lifetime_quantity": 1,
                "lifetime_revenue": 10,
                "lifetime_profit": 2,
                "order_penetration_pct": 5,
                "consistency_score": 1,
            },
            {
                "product_key": "b",
                "lifetime_quantity": 9,
                "lifetime_revenue": 90,
                "lifetime_profit": 20,
                "order_penetration_pct": 50,
                "consistency_score": 4,
            },
        ]
        rankings = build_overall_rankings(overall, limit=1)
        self.assertEqual(rankings["top_profit"][0]["product_key"], "b")
        self.assertEqual(rankings["top_penetration"][0]["product_key"], "b")
        self.assertEqual(rankings["most_consistent"][0]["product_key"], "b")

    @patch("analytics_service.fetch_period_product_metrics")
    def test_get_period_analytics_with_ranking(self, mock_fetch) -> None:
        mock_fetch.return_value = {
            "timeline": {"id": "t1", "period_label": "Jun 2026", "period_start": "2026-06-01", "period_end": "2026-06-15"},
            "period_days": 15,
            "previous_timeline_id": None,
            "products": SAMPLE_PERIOD_PRODUCTS,
        }
        result = get_period_analytics("t1", ranking="top_revenue", limit=2)
        self.assertEqual(result["analysis_type"], "period")
        self.assertEqual(len(result["products"]), 2)
        self.assertEqual(result["products"][0]["product_key"], "sku-c")
        self.assertIn("top_quantity", result["rankings"])

    @patch("analytics_service.fetch_period_product_metrics")
    def test_get_period_analytics_not_found(self, mock_fetch) -> None:
        mock_fetch.return_value = None
        with self.assertRaises(ValueError):
            get_period_analytics("missing-id")

    @patch("analytics_service._distinct_timeline_count", return_value=3)
    @patch("analytics_service.fetch_overall_product_metrics")
    def test_get_overall_analytics(self, mock_fetch, _mock_count) -> None:
        mock_fetch.return_value = [
            {
                "product_key": "sku-a",
                "item_name": "A",
                "merchant_sku": "sku-a",
                "lifetime_quantity": 10,
                "lifetime_revenue": 100,
                "lifetime_profit": 20,
                "has_profit_data": True,
                "orders_with_product": 5,
                "total_order_count": 10,
                "order_penetration_pct": 50.0,
                "consistency_score": 2,
            }
        ]
        result = get_overall_analytics(sort="lifetime_profit", limit=5)
        self.assertEqual(result["analysis_type"], "overall")
        self.assertEqual(result["timeline_count"], 3)
        self.assertEqual(result["products"][0]["lifetime_profit"], 20)


if __name__ == "__main__":
    unittest.main()
