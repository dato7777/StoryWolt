"""Tests for NewOrder sync helpers (no live API)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from uuid import uuid4

API_DIR = Path(__file__).resolve().parents[1] / "api"
sys.path.insert(0, str(API_DIR))

from neworder_sync_service import _api_product_to_upsert, _date_range_inclusive, _sync_dates_for_hours  # noqa: E402


class TestNewOrderSyncMapping(unittest.TestCase):
    def test_api_product_to_upsert_maps_camel_case_fields(self) -> None:
        category_id = uuid4()
        supplier_id = uuid4()
        row = {
            "id": "875412",
            "name": "USB Cable",
            "barcode": "7290001112223",
            "costNoTax": 12.5,
            "cost": 14.75,
            "price": 29.9,
            "isSerial": False,
            "category": {"id": "3", "name": "Accessories"},
            "supplier": {"id": "7", "name": "Acme"},
            "isTaxFree": False,
            "isStock": True,
            "isActive": True,
            "description": "1m cable",
            "additionalBarcodes": ["ALT-001", "ALT-002"],
            "currentStock": 4,
        }

        product = _api_product_to_upsert(
            row,
            category_map={"3": category_id},
            supplier_map={"7": supplier_id},
        )

        self.assertEqual(product.neworder_id, "875412")
        self.assertEqual(product.name, "USB Cable")
        self.assertEqual(product.barcode, "7290001112223")
        self.assertEqual(product.cost_no_tax, 12.5)
        self.assertEqual(product.cost, 14.75)
        self.assertEqual(product.price, 29.9)
        self.assertEqual(product.category_id, category_id)
        self.assertEqual(product.category_name, "Accessories")
        self.assertEqual(product.supplier_id, supplier_id)
        self.assertEqual(product.supplier_name, "Acme")
        self.assertEqual(product.additional_barcodes, ("ALT-001", "ALT-002"))


class TestDocumentDateChunking(unittest.TestCase):
    def test_date_range_inclusive(self) -> None:
        from datetime import date

        days = _date_range_inclusive(date(2026, 6, 22), date(2026, 6, 25))
        self.assertEqual(len(days), 4)
        self.assertEqual(days[0].isoformat(), "2026-06-22")
        self.assertEqual(days[-1].isoformat(), "2026-06-25")

    def test_date_range_inclusive_empty_when_end_before_start(self) -> None:
        from datetime import date

        self.assertEqual(_date_range_inclusive(date(2026, 6, 25), date(2026, 6, 22)), [])

    def test_sync_dates_for_hours_covers_one_or_two_days(self) -> None:
        days = _sync_dates_for_hours(24)
        self.assertGreaterEqual(len(days), 1)
        self.assertLessEqual(len(days), 2)


if __name__ == "__main__":
    unittest.main()
