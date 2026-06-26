"""Normalize NewOrder product identifiers for deduplication."""

from __future__ import annotations


def normalize_product_name(value: str | None) -> str:
    """Case- and whitespace-insensitive product name key."""
    if not value:
        return ""
    return " ".join(str(value).strip().split()).casefold()


def normalize_barcode(value: str | None) -> str:
    """Uppercase, trimmed SKU / barcode key. Empty string if missing."""
    if not value:
        return ""
    return str(value).strip().upper()


def product_identity_key(name: str | None, barcode: str | None) -> tuple[str, str]:
    return normalize_product_name(name), normalize_barcode(barcode)
