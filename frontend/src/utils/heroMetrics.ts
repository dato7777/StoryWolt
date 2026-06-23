import type { CalculationSummary } from "../types";

export interface HeroMetrics {
  soldTotal: number;
  woltExpenses: number;
  payout: number | null;
  headlineNet: number | null;
  hasWoltSummary: boolean;
}

/** Same headline figures as Dashboard period-totals cascade. */
export function computeHeroMetrics(summary: CalculationSummary): HeroMetrics {
  const hasWoltSummary = summary.wolt_summary_gross_goods != null;
  const selfCost = summary.total_product_self_cost ?? 0;
  const ordersSold = summary.total_sold_value ?? summary.total_gross;

  const woltNetIncome =
    summary.wolt_summary_net_income ??
    (summary.wolt_summary_payout != null ? summary.wolt_summary_payout - selfCost : null);

  const soldTotal = hasWoltSummary ? summary.wolt_summary_gross_goods! : ordersSold;
  const woltExpenses = hasWoltSummary
    ? summary.wolt_summary_expenses_incl_vat ?? 0
    : summary.total_commission_with_vat;
  const payout = hasWoltSummary ? summary.wolt_summary_payout ?? null : null;
  const headlineNet = hasWoltSummary ? woltNetIncome : summary.total_net_income;

  return { soldTotal, woltExpenses, payout, headlineNet, hasWoltSummary };
}

function sumNumbers(values: (number | null | undefined)[]): number | null {
  const numbers = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (numbers.length === 0) return null;
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

/** Aggregate headline totals across multiple period summaries. */
export function sumHeroMetrics(summaries: CalculationSummary[]): HeroMetrics {
  const metrics = summaries.map(computeHeroMetrics);
  const anyWoltSummary = metrics.some((item) => item.hasWoltSummary);

  return {
    soldTotal: sumNumbers(metrics.map((item) => item.soldTotal)) ?? 0,
    woltExpenses: sumNumbers(metrics.map((item) => item.woltExpenses)) ?? 0,
    payout: sumNumbers(metrics.map((item) => item.payout)),
    headlineNet: sumNumbers(metrics.map((item) => item.headlineNet)),
    hasWoltSummary: anyWoltSummary,
  };
}
