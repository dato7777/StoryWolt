import type { CalculationSummary } from "../types";

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateRange(start: Date, end: Date): string {
  const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dayOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric" });

  if (start.toDateString() === end.toDateString()) {
    return dayMonthYear.format(start);
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${dayOnly.format(start)}–${dayMonthYear.format(end)}`;
  }
  return `${dayMonthYear.format(start)} – ${dayMonthYear.format(end)}`;
}

/** Resolve a display-ready report period from summary fields. */
export function formatReportPeriod(summary: CalculationSummary): string | null {
  if (summary.report_period_label?.trim()) {
    return summary.report_period_label.trim();
  }
  if (summary.report_period_start && summary.report_period_end) {
    const start = parseIsoDate(summary.report_period_start);
    const end = parseIsoDate(summary.report_period_end);
    if (start && end) {
      return formatDateRange(start, end);
    }
  }
  return null;
}
