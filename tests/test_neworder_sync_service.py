"""Tests for NewOrder sync helpers (no live API)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from uuid import uuid4

API_DIR = Path(__file__).resolve().parents[1] / "api"
sys.path.insert(0, str(API_DIR))

from neworder_sync_service import _api_product_to_upsert  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
