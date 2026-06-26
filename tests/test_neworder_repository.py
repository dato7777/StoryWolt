"""Tests for NewOrder product normalization and batch dedupe."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1] / "api"
sys.path.insert(0, str(API_DIR))

from neworder_normalize import (  # noqa: E402
    normalize_barcode,
    normalize_product_name,
    product_identity_key,
)


class TestNewOrderNormalize(unittest.TestCase):
    def test_normalize_product_name_case_and_spaces(self) -> None:
        self.assertEqual(
            normalize_product_name("  iPhone   15  Case "),
            "iphone 15 case",
        )

    def test_normalize_barcode_uppercase(self) -> None:
        self.assertEqual(normalize_barcode(" sku-875412 "), "SKU-875412")

    def test_product_identity_key(self) -> None:
        self.assertEqual(
            product_identity_key("Galaxy A55", "abc123"),
            ("galaxy a55", "ABC123"),
        )

    def test_batch_payload_dedupes_same_name(self) -> None:
        seen_names: set[str] = set()
        skipped = 0
        names = ["USB Cable", "usb  cable", "Galaxy A55"]
        for name in names:
            key = normalize_product_name(name)
            if key in seen_names:
                skipped += 1
                continue
            seen_names.add(key)
        self.assertEqual(skipped, 1)


if __name__ == "__main__":
    unittest.main()
