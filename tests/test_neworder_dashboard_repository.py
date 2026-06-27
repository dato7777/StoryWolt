"""Tests for NewOrder dashboard SQL helpers."""

from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1] / "api"
sys.path.insert(0, str(API_DIR))

from neworder_dashboard_repository import (  # noqa: E402
    _attendance_period_sql,
    _document_period_sql,
    parse_iso_date,
    resolve_date_range,
)


class TestAttendancePeriodSql(unittest.TestCase):
    def test_today_uses_jerusalem_calendar_date(self) -> None:
        sql = _attendance_period_sql("today")
        self.assertIn("a.enter_date", sql)
        self.assertIn("Asia/Jerusalem", sql)

    def test_yesterday_offsets_one_day(self) -> None:
        sql = _attendance_period_sql("yesterday")
        self.assertIn("- 1", sql)

    def test_range_uses_inclusive_bounds(self) -> None:
        start = date(2026, 3, 1)
        end = date(2026, 3, 10)
        sql = _attendance_period_sql("range", start_date=start, end_date=end)
        self.assertIn(">= '2026-03-01'", sql)
        self.assertIn("<= '2026-03-10'", sql)

    def test_hours_uses_shift_start_timestamp(self) -> None:
        sql = _attendance_period_sql("hours", hours=24)
        self.assertIn("enter_time", sql)
        self.assertIn("make_interval(hours => 24)", sql)


class TestDocumentPeriodSql(unittest.TestCase):
    def test_range_filters_create_date(self) -> None:
        sql = _document_period_sql(
            "range",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
        )
        self.assertIn(">= '2026-02-01'", sql)
        self.assertIn("<= '2026-02-28'", sql)


class TestDateRangeHelpers(unittest.TestCase):
    def test_parse_iso_date(self) -> None:
        self.assertEqual(parse_iso_date("2026-06-25"), date(2026, 6, 25))

    def test_resolve_date_range_rejects_inverted(self) -> None:
        with self.assertRaises(ValueError):
            resolve_date_range(date(2026, 6, 10), date(2026, 6, 1))

    def test_resolve_date_range_label_single_day(self) -> None:
        _, _, label = resolve_date_range(date(2026, 6, 25), date(2026, 6, 25))
        self.assertIn("Jun", label)
        self.assertIn("2026", label)


if __name__ == "__main__":
    unittest.main()
