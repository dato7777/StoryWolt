/**
 * Analytical financial dashboard — structured Wolt period overview.
 */

import { CountUpCurrency } from "./CountUpCurrency";
import type { CalculationSummary } from "../types";

interface DashboardProps {
  summary: CalculationSummary;
  includeAllocatedAdCost?: boolean;
}

function formatIls(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(n);
}

function pct(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

interface MetricProps {
  label: string;
  hint?: string;
  value: number | null | undefined;
  tone?: "neutral" | "sky" | "amber" | "orange" | "rose" | "violet" | "emerald";
  delay?: number;
}

const toneStyles = {
  neutral: {
    border: "border-slate-200/80",
    icon: "bg-slate-100 text-slate-600",
    value: "text-ink",
  },
  sky: {
    border: "border-sky-200/80",
    icon: "bg-sky-100 text-sky-700",
    value: "text-sky-800",
  },
  amber: {
    border: "border-amber-200/80",
    icon: "bg-amber-100 text-amber-800",
    value: "text-amber-800",
  },
  orange: {
    border: "border-orange-200/80",
    icon: "bg-orange-100 text-orange-800",
    value: "text-orange-800",
  },
  rose: {
    border: "border-rose-200/80",
    icon: "bg-rose-100 text-rose-800",
    value: "text-rose-800",
  },
  violet: {
    border: "border-violet-200/80",
    icon: "bg-violet-100 text-violet-800",
    value: "text-violet-800",
  },
  emerald: {
    border: "border-emerald-200/80",
    icon: "bg-emerald-100 text-emerald-800",
    value: "text-emerald-800",
  },
} as const;

function MetricTile({ label, hint, value, tone = "neutral", delay = 0 }: MetricProps) {
  const styles = toneStyles[tone];
  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className={`analytics-metric animate-fade-up opacity-0 ${styles.border}`}
    >
      <p className="analytics-label">{label}</p>
      {hint && (
        <p className="mt-1 text-xs font-medium leading-snug text-ink-faint">{hint}</p>
      )}
      <p className={`analytics-metric-value mt-3 ${styles.value}`}>
        <CountUpCurrency value={value} durationMs={1000} />
      </p>
    </article>
  );
}

interface HeroProps {
  label: string;
  formula: string;
  value: number | null | undefined;
  variant: "payout" | "profit";
  delay?: number;
}

function HeroMetric({ label, formula, value, variant, delay = 0 }: HeroProps) {
  const isProfit = variant === "profit";
  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className={`analytics-hero animate-fade-up opacity-0 ${
        isProfit
          ? "border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 shadow-glow-emerald"
          : "border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-indigo-50/80 shadow-glow"
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl ${
          isProfit ? "bg-emerald-400/25" : "bg-sky-400/25"
        }`}
      />
      <p className="analytics-label">{label}</p>
      <p
        className={`mt-4 font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl lg:text-[3.25rem] ${
          isProfit ? "text-emerald-700" : "text-sky-800"
        }`}
      >
        <CountUpCurrency value={value} durationMs={1400} />
      </p>
      <p className="mt-3 text-sm font-medium text-ink-muted">{formula}</p>
    </article>
  );
}

function SectionHeader({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${accent}`} />
      <div>
        <h3 className="font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
          {title}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-ink-faint sm:text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function FlowStep({
  label,
  value,
  pctWidth,
  color,
}: {
  label: string;
  value: string;
  pctWidth: number;
  color: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <span className="font-mono text-xs font-semibold tabular-nums text-ink">{value}</span>
      </div>
      <div className="analytics-flow-bar">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pctWidth}%` }}
        />
      </div>
    </div>
  );
}

export function Dashboard({ summary, includeAllocatedAdCost = false }: DashboardProps) {
  const hasWoltSummary = summary.wolt_summary_gross_goods != null;
  const selfCost = summary.total_product_self_cost ?? 0;
  const ordersSold = summary.total_sold_value ?? summary.total_gross;

  const woltNetIncome =
    summary.wolt_summary_net_income ??
    (summary.wolt_summary_payout != null
      ? summary.wolt_summary_payout - selfCost
      : null);

  const excludedDefault =
    summary.per_item_expenses_excluded_incl_vat ??
    (hasWoltSummary && summary.wolt_summary_expenses_incl_vat != null
      ? Math.round(
          (summary.wolt_summary_expenses_incl_vat - summary.total_commission_with_vat) * 100,
        ) / 100
      : null);

  const excludedAfterAds = summary.per_item_expenses_excluded_after_ads_incl_vat ?? excludedDefault;
  const excludedDisplay = includeAllocatedAdCost ? excludedAfterAds : excludedDefault;

  const adCampaigns = summary.wolt_summary_ad_campaigns_incl_vat ?? 0;
  const adAllocated = summary.wolt_summary_ad_campaigns_allocated_incl_vat ?? 0;
  const otherFees = summary.wolt_summary_other_fees_incl_vat ?? 0;
  const distributionGap = summary.wolt_summary_distribution_gap_incl_vat ?? 0;
  const selfBillingNet = summary.wolt_summary_self_billing_deductions_incl_vat ?? 0;
  const selfBillingNegative = summary.wolt_summary_self_billing_negative_incl_vat ?? 0;
  const selfBillingNetAdd = summary.wolt_summary_self_billing_deductions_incl_vat ?? 0;
  const woltInvoiceOnly = hasWoltSummary
    ? (summary.wolt_summary_expenses_incl_vat ?? 0) - selfBillingNetAdd
    : 0;

  const soldTotal = hasWoltSummary ? summary.wolt_summary_gross_goods! : ordersSold;
  const woltExpenses = hasWoltSummary
    ? summary.wolt_summary_expenses_incl_vat ?? 0
    : summary.total_commission_with_vat;
  const payout = hasWoltSummary ? summary.wolt_summary_payout : null;
  const headlineNet = hasWoltSummary ? woltNetIncome : summary.total_net_income;

  const expenseRows = hasWoltSummary
    ? [
        adCampaigns > 0 && {
          label: "Ad campaigns",
          detail: includeAllocatedAdCost && adAllocated > 0
            ? `${formatIls(adAllocated)} allocated to orders`
            : "Not on order rows until toggle enabled",
          value: adCampaigns,
        },
        otherFees > 0 && {
          label: "Other Wolt fees",
          detail: "Lateness, delivery discount, resends, VAT adj.",
          value: otherFees,
        },
        Math.abs(distributionGap) > 0.01 && {
          label: "Distribution gap",
          detail: "Invoice distribution vs order commission calc",
          value: distributionGap,
        },
        Math.abs(selfBillingNet) > 0.01 && {
          label: "Self-billing",
          detail: "Remunerations, merchant discounts, corrections",
          value: selfBillingNet,
        },
      ].filter(Boolean) as { label: string; detail: string; value: number }[]
    : [];

  return (
    <section className="analytics-shell">
      <div className="analytics-grid-bg border-b border-slate-200/60 px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="analytics-pill border-indigo-200/80 bg-indigo-50 text-indigo-800">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Analytics
              </span>
              {hasWoltSummary ? (
                <span className="analytics-pill border-emerald-200/80 bg-emerald-50 text-emerald-800">
                  Wolt invoice synced
                </span>
              ) : (
                <span className="analytics-pill border-amber-200/80 bg-amber-50 text-amber-900">
                  Orders only — upload standardSummary
                </span>
              )}
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Financial overview
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm font-medium text-ink-muted">
              {hasWoltSummary
                ? "Official Wolt payout reconciled with your delivered orders and product costs."
                : "Commission estimate from orders. Upload standardSummary.csv for full Wolt expenses."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="analytics-pill border-slate-200 bg-white text-ink-muted">
              <span className="font-mono font-semibold text-ink">
                {summary.delivered_order_count ?? 0}
              </span>{" "}
              delivered
            </span>
            <span className="analytics-pill border-slate-200 bg-white text-ink-muted">
              <span className="font-mono font-semibold text-ink">
                {summary.matched_count}
              </span>
              <span className="text-ink-faint">/{summary.row_count}</span> matched
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-8">
        {/* Hero outcomes */}
        <div className="grid gap-4 lg:grid-cols-2">
          <HeroMetric
            label="Net income totally"
            formula={
              hasWoltSummary
                ? "Payout NET − product self cost (incl. VAT)"
                : "Sold − Wolt commission − product self cost"
            }
            value={headlineNet}
            variant="profit"
            delay={0}
          />
          {hasWoltSummary && payout != null ? (
            <HeroMetric
              label="Payout NET"
              formula="Goods sold − all Wolt expenses → bank transfer"
              value={payout}
              variant="payout"
              delay={80}
            />
          ) : (
            <article
              style={{ animationDelay: "80ms" }}
              className="analytics-hero animate-fade-up opacity-0 border-dashed border-slate-300 bg-slate-50/80"
            >
              <p className="analytics-label">Payout NET</p>
              <p className="mt-4 font-display text-lg font-semibold text-ink-muted">
                Upload standardSummary.csv
              </p>
              <p className="mt-2 text-sm text-ink-faint">
                Required for official Wolt bank payout and expense totals.
              </p>
            </article>
          )}
        </div>

        {/* Money flow */}
        {hasWoltSummary && soldTotal > 0 && (
          <div
            style={{ animationDelay: "120ms" }}
            className="analytics-section animate-fade-up opacity-0"
          >
            <SectionHeader
              title="Money flow"
              subtitle="How Wolt invoice totals connect — all amounts incl. VAT"
              accent="bg-gradient-to-b from-slate-500 to-slate-300"
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
              <FlowStep
                label="Goods sold"
                value={formatIls(soldTotal)}
                pctWidth={100}
                color="bg-slate-500"
              />
              <span className="hidden shrink-0 pb-1 text-slate-300 sm:block">−</span>
              <FlowStep
                label="Wolt expenses"
                value={formatIls(woltExpenses)}
                pctWidth={pct(woltExpenses, soldTotal)}
                color="bg-orange-500"
              />
              <span className="hidden shrink-0 pb-1 text-slate-300 sm:block">=</span>
              <FlowStep
                label="Payout"
                value={formatIls(payout)}
                pctWidth={pct(payout ?? 0, soldTotal)}
                color="bg-sky-500"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-4 text-xs font-medium text-ink-faint">
              <span>Self cost (your COGS): {formatIls(selfCost)}</span>
              <span>Net after COGS: {formatIls(woltNetIncome)}</span>
            </div>
          </div>
        )}

        {/* Metric grids */}
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <div className="analytics-section h-full">
              <SectionHeader
                title="Revenue"
                subtitle="What customers paid vs Wolt menu list value"
                accent="bg-gradient-to-b from-slate-600 to-slate-400"
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <MetricTile
                  label="Actual sold total"
                  hint={hasWoltSummary ? "standardSummary · goods sold" : "Delivered orders sum"}
                  value={soldTotal}
                  tone="neutral"
                  delay={160}
                />
                <MetricTile
                  label="Wolt menu list value"
                  hint="From offers_commission.xlsx"
                  value={summary.total_list_value}
                  tone="neutral"
                  delay={200}
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="analytics-section h-full">
              <SectionHeader
                title="Wolt costs"
                subtitle="Fees charged by Wolt for this period"
                accent="bg-gradient-to-b from-orange-500 to-amber-400"
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {hasWoltSummary ? (
                  <>
                    <MetricTile
                      label="Expenses before VAT"
                      hint="WOLT INVOICE + self-billing (net)"
                      value={summary.wolt_summary_expenses_net}
                      tone="amber"
                      delay={240}
                    />
                    <MetricTile
                      label="Expenses incl. VAT"
                      hint={
                        selfBillingNegative > 0
                          ? `Invoice ${formatIls(woltInvoiceOnly)} + self-billing ${formatIls(selfBillingNegative)}`
                          : "Distribution, ads, discounts…"
                      }
                      value={summary.wolt_summary_expenses_incl_vat}
                      tone="orange"
                      delay={280}
                    />
                  </>
                ) : (
                  <>
                    <MetricTile
                      label="Commission before VAT"
                      value={summary.total_commission_before_vat}
                      tone="amber"
                      delay={240}
                    />
                    <MetricTile
                      label="Commission incl. VAT"
                      hint="Distribution fee × 1.18"
                      value={summary.total_commission_with_vat}
                      tone="orange"
                      delay={280}
                    />
                  </>
                )}
                <MetricTile
                  label="Product self cost"
                  hint="COGS incl. VAT × quantity"
                  value={selfCost}
                  tone="violet"
                  delay={320}
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="analytics-section h-full">
              <SectionHeader
                title="Per-item gap"
                subtitle="Invoice costs not in default order/product net income"
                accent="bg-gradient-to-b from-rose-500 to-pink-400"
              />
              {hasWoltSummary && excludedDisplay != null ? (
                <>
                  <div
                    style={{ animationDelay: "360ms" }}
                    className="animate-fade-up opacity-0 rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white p-4"
                  >
                    <p className="analytics-label text-rose-700/80">Still excluded from rows</p>
                    <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-rose-800">
                      <CountUpCurrency value={excludedDisplay} durationMs={1100} />
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-rose-900/70">
                      {includeAllocatedAdCost
                        ? "After ad allocation on orders — other fees remain outside line net income."
                        : "Enable ad allocation toggle to deduct campaign costs from order rows."}
                    </p>
                  </div>
                  {expenseRows.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {expenseRows.map((row) => (
                        <li
                          key={row.label}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white/80 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{row.label}</p>
                            <p className="text-[11px] font-medium text-ink-faint">{row.detail}</p>
                          </div>
                          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink-muted">
                            {formatIls(row.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-ink-muted">No invoice gap analysis</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Upload standardSummary to compare Wolt invoice vs order calc.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div
          style={{ animationDelay: "400ms" }}
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200/70 bg-slate-50/80 px-5 py-3.5 text-xs font-semibold text-ink-muted animate-fade-up opacity-0"
        >
          <span>
            Data quality:{" "}
            <span className="font-mono text-ink">{summary.matched_count}</span>/
            {summary.row_count} products matched
          </span>
          {(summary.rejected_order_count ?? 0) > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-violet-300" />
              <span className="text-violet-700">
                {summary.rejected_order_count} rejected orders excluded
              </span>
            </>
          )}
          {hasWoltSummary && selfBillingNegative > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-amber-300" />
              <span className="text-amber-800">
                Self-billing +{formatIls(selfBillingNegative)} on expenses
              </span>
            </>
          )}
          {hasWoltSummary && includeAllocatedAdCost && adAllocated > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-sky-300" />
              <span className="text-sky-800">Ad cost on rows: {formatIls(adAllocated)}</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
