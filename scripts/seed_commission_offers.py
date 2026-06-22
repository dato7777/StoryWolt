#!/usr/bin/env python3
"""
Import offers_commission.xlsx into Supabase commission_offers table.

Usage:
    cp .env.example .env   # set DATABASE_URL
    python scripts/seed_commission_offers.py

Optional:
    python scripts/seed_commission_offers.py --file data/offers_commission.xlsx
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    import os

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed commission catalog to Supabase")
    parser.add_argument(
        "--file",
        type=Path,
        default=ROOT / "data" / "offers_commission.xlsx",
        help="Path to offers_commission.xlsx",
    )
    parser.add_argument("--notes", default="Manual seed via scripts/seed_commission_offers.py")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")

    from commission_engine import load_offers_from_xlsx
    from db_repository import import_commission_offers, offers_from_xlsx_rows
    from supabase_client import is_db_configured

    if not is_db_configured():
        print("ERROR: Set DATABASE_URL in .env (Supabase → Project Settings → Database → URI)")
        sys.exit(1)

    if not args.file.exists():
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)

    offers_by_name = load_offers_from_xlsx(args.file)
    rows = offers_from_xlsx_rows(offers_by_name)
    version_id = import_commission_offers(
        rows,
        source_label=args.file.name,
        notes=args.notes,
    )
    print(f"Imported {len(rows)} offers → catalog version {version_id}")


if __name__ == "__main__":
    main()
