"""Resolve commission catalog from Supabase or local xlsx fallback."""

from __future__ import annotations

from pathlib import Path

from commission_engine import build_offer_indexes, load_offers_from_xlsx
from db_repository import (
    get_active_catalog_version_id,
    import_commission_offers,
    load_active_commission_offers,
    offers_from_xlsx_rows,
)
from supabase_client import is_db_configured


def resolve_commission_catalog(
    offers_path: Path,
) -> tuple[dict, dict, str | None]:
    """
    Return (offers_by_name, offers_by_sku, catalog_version_id).

    Uses active Supabase catalog when DATABASE_URL is set; falls back to xlsx.
    Auto-seeds Supabase from xlsx on first use if catalog is empty.
    """
    if is_db_configured():
        try:
            offers_by_name = load_active_commission_offers()
            if not offers_by_name and offers_path.exists():
                xlsx_offers = load_offers_from_xlsx(offers_path)
                import_commission_offers(
                    offers_from_xlsx_rows(xlsx_offers),
                    source_label=offers_path.name,
                    notes="Auto-imported on first API use",
                )
                offers_by_name = load_active_commission_offers()

            if offers_by_name:
                by_name, by_sku = build_offer_indexes(offers_by_name)
                return by_name, by_sku, get_active_catalog_version_id()
        except Exception as exc:
            print(f"[commission] Supabase catalog unavailable, using xlsx: {exc}")

    if not offers_path.exists():
        raise FileNotFoundError(f"Commission lookup file not found: {offers_path}")

    offers_by_name = load_offers_from_xlsx(offers_path)
    by_name, by_sku = build_offer_indexes(offers_by_name)
    return by_name, by_sku, None
