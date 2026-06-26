"""Tests for NewOrder dashboard SQL helpers."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1] / "api"
sys.path.insert(0, str(API_DIR))

from neworder_dashboard_repository import _attendance_period_sql  # noqa: E402


class TestAttendancePeriodSql(unittest.TestCase):
    def test_today_uses_jerusalem_calendar_date(self) -> None:
        sql = _attendance_period_sql("today")
        self.assertIn("a.enter_date", sql)
        self.assertIn("Asia/Jerusalem", sql)

    def test_yesterday_offsets_one_day(self) -> None:
        sql = _attendance_period_sql("yesterday")
        self.assertIn("- 1", sql)

    def test_week_covers_seven_day_window(self) -> None:
        sql = _attendance_period_sql("week")
        self.assertIn("- 6", sql)
        self.assertIn("<=", sql)

    def test_hours_uses_shift_start_timestamp(self) -> None:
        sql = _attendance_period_sql("hours", hours=24)
        self.assertIn("enter_time", sql)
        self.assertIn("make_interval(hours => 24)", sql)


if __name__ == "__main__":
    unittest.main()
