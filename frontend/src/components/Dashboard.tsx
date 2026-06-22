/**
 * Analytical financial dashboard — structured Wolt period overview.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountUpCurrency } from "./CountUpCurrency";
import { useI18n } from "../i18n/LanguageContext";
import type { CalculationSummary } from "../types";
import { formatReportPeriod } from "../utils/formatReportPeriod";

interface DashboardProps {
  summary: CalculationSummary;
  includeAllocatedAdCost?: boolean;
  onHeroCascadeComplete?: () => void;
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

interface HeroStep {
  id: string;
  stepNumber: number;
  label: string;
  hint: string;
  value: number | null | undefined;
  enterAnimation: "enter-left" | "enter-right" | "zoom-in";
  cardClass: string;
  indexClass: string;
  valueClass: string;
  glowClass: string;
}

const COUNT_DURATION_MS = 1500;
const PAUSE_AFTER_COUNT_MS = 220;

const ENTER_ANIM_CLASSES: Record<HeroStep["enterAnimation"], string> = {
  "enter-left": "animate-hero-enter-left",
  "enter-right": "animate-hero-enter-right",
  "zoom-in": "animate-hero-zoom-in",
};

function HeroCascadeCard({
  step,
  isCounting,
  settled,
  onCountComplete,
  uploadLabel,
}: {
  step: HeroStep;
  isCounting: boolean;
  settled: boolean;
  onCountComplete: () => void;
  uploadLabel: string;
}) {
  useEffect(() => {
    if (!isCounting) return;
    if (step.value == null || Number.isNaN(step.value)) {
      const timer = window.setTimeout(onCountComplete, 480);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isCounting, step.value, onCountComplete]);

  return (
    <article
      className={`hero-cascade-card ${
        settled
          ? `opacity-100 ${step.cardClass}`
          : `opacity-0 ${ENTER_ANIM_CLASSES[step.enterAnimation]} ${step.cardClass}`
      }`}
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-3xl ${step.glowClass}`} />
      <div className="flex items-start justify-between gap-4">
        <span className={`hero-cascade-index ${step.indexClass}`}>
          {String(step.stepNumber).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-ink sm:text-xl">
        {step.label}
      </h3>
      <p className="mt-1 text-xs font-medium text-ink-faint sm:text-sm">{step.hint}</p>
      <p className={`mt-5 font-mono text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl lg:text-[2.75rem] ${step.valueClass}`}>
        {step.value != null && !Number.isNaN(step.value) ? (
          <CountUpCurrency
            value={step.value}
            durationMs={COUNT_DURATION_MS}
            animate={isCounting}
            onComplete={isCounting ? onCountComplete : undefined}
          />
        ) : (
          <span className="text-xl sm:text-2xl">{uploadLabel}</span>
        )}
      </p>
    </article>
  );
}

function MainHeroCascade({
  steps,
  onComplete,
  uploadLabel,
}: {
  steps: HeroStep[];
  onComplete?: () => void;
  uploadLabel: string;
}) {
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const cascadeKey = useMemo(
    () => steps.map((step) => `${step.id}:${step.value ?? "null"}`).join("|"),
    [steps],
  );

  useEffect(() => {
    setRevealedIndex(-1);
    cardRefs.current = [];
    const timer = window.setTimeout(() => setRevealedIndex(0), 120);
    return () => window.clearTimeout(timer);
  }, [cascadeKey]);

  useEffect(() => {
    if (revealedIndex < 0) return;
    const timer = window.setTimeout(() => {
      cardRefs.current[revealedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: revealedIndex === 0 ? "start" : "center",
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [revealedIndex, cascadeKey]);

  const handleCountComplete = useCallback(
    (index: number) => {
      window.setTimeout(() => {
        setRevealedIndex((current) => {
          if (current !== index) return current;
          return index < steps.length - 1 ? index + 1 : current;
        });
        if (index === steps.length - 1) {
          onCompleteRef.current?.();
        }
      }, PAUSE_AFTER_COUNT_MS);
    },
    [steps.length],
  );

  return (
    <div className="relative mx-auto max-w-3xl py-2 sm:py-4">
      {steps.map((step, index) => {
        if (index > revealedIndex) return null;
        return (
          <div
            key={step.id}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className="relative scroll-mt-28"
            style={{
              marginLeft: `calc(${index} * clamp(1rem, 5vw, 2.75rem))`,
              marginTop:
                index === 0 ? 0 : `calc(${index} * clamp(0.6rem, 2.5vw, 1.35rem))`,
              zIndex: steps.length - index,
            }}
          >
            <HeroCascadeCard
              step={step}
              isCounting={index === revealedIndex}
              settled={index < revealedIndex}
              onCountComplete={() => handleCountComplete(index)}
              uploadLabel={uploadLabel}
            />
          </div>
        );
      })}
    </div>
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

export function Dashboard({
  summary,
  includeAllocatedAdCost = false,
  onHeroCascadeComplete,
}: DashboardProps) {
  const { t } = useI18n();
  const hasWoltSummary = summary.wolt_summary_gross_goods != null;
  const reportPeriod = formatReportPeriod(summary);
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
          label: t("dashboard.expenseAdCampaigns"),
          detail:
            includeAllocatedAdCost && adAllocated > 0
              ? t("dashboard.expenseAdAllocated", { amount: formatIls(adAllocated) })
              : t("dashboard.expenseAdNotOnRows"),
          value: adCampaigns,
        },
        otherFees > 0 && {
          label: t("dashboard.expenseOtherFees"),
          detail: t("dashboard.expenseOtherDetail"),
          value: otherFees,
        },
        Math.abs(distributionGap) > 0.01 && {
          label: t("dashboard.expenseDistributionGap"),
          detail: t("dashboard.expenseDistributionDetail"),
          value: distributionGap,
        },
        Math.abs(selfBillingNet) > 0.01 && {
          label: t("dashboard.expenseSelfBilling"),
          detail: t("dashboard.expenseSelfBillingDetail"),
          value: selfBillingNet,
        },
      ].filter(Boolean) as { label: string; detail: string; value: number }[]
    : [];

  const heroSteps: HeroStep[] = [
    {
      id: "goods-sold",
      stepNumber: 1,
      label: t("dashboard.heroGoodsSold"),
      hint: hasWoltSummary ? t("dashboard.heroGoodsHintInvoice") : t("dashboard.heroGoodsHintOrders"),
      value: soldTotal,
      enterAnimation: "enter-left",
      cardClass:
        "border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-100/80",
      indexClass: "text-slate-500",
      valueClass: "text-ink",
      glowClass: "bg-slate-400/20",
    },
    {
      id: "wolt-expenses",
      stepNumber: 2,
      label: t("dashboard.heroWoltExpenses"),
      hint: hasWoltSummary ? t("dashboard.heroWoltHintInvoice") : t("dashboard.heroWoltHintOrders"),
      value: woltExpenses,
      enterAnimation: "enter-right",
      cardClass:
        "border-orange-200/90 bg-gradient-to-br from-orange-50 via-white to-amber-50/80",
      indexClass: "text-orange-600",
      valueClass: "text-orange-800",
      glowClass: "bg-orange-400/25",
    },
    {
      id: "payout",
      stepNumber: 3,
      label: t("dashboard.heroPayout"),
      hint: t("dashboard.heroPayoutHint"),
      value: payout,
      enterAnimation: "enter-left",
      cardClass:
        "border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-indigo-50/80 shadow-glow",
      indexClass: "text-sky-600",
      valueClass: "text-sky-800",
      glowClass: "bg-sky-400/25",
    },
    {
      id: "story-net",
      stepNumber: 4,
      label: t("dashboard.heroStoryNet"),
      hint: hasWoltSummary ? t("dashboard.heroStoryHintInvoice") : t("dashboard.heroStoryHintOrders"),
      value: headlineNet,
      enterAnimation: "zoom-in",
      cardClass:
        "border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 shadow-glow-emerald",
      indexClass: "text-emerald-600",
      valueClass: "text-emerald-700",
      glowClass: "bg-emerald-400/25",
    },
  ];

  return (
    <section className="analytics-shell">
      <div className="analytics-grid-bg border-b border-slate-200/60 px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="analytics-pill border-indigo-200/80 bg-indigo-50 text-indigo-800">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                {t("dashboard.analytics")}
              </span>
              {hasWoltSummary ? (
                <span className="analytics-pill border-emerald-200/80 bg-emerald-50 text-emerald-800">
                  {t("dashboard.invoiceSynced")}
                </span>
              ) : (
                <span className="analytics-pill border-amber-200/80 bg-amber-50 text-amber-900">
                  {t("dashboard.ordersOnly")}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t("dashboard.financialOverview")}
              </h2>
              {reportPeriod && (
                <>
                  <span
                    className="hidden h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-slate-300 to-transparent sm:block"
                    aria-hidden
                  />
                  <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/90 bg-gradient-to-r from-violet-50/95 via-white to-indigo-50/90 px-3.5 py-1.5 shadow-sm shadow-violet-500/10">
                    <svg
                      className="h-4 w-4 shrink-0 text-violet-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="font-mono text-sm font-semibold tabular-nums tracking-tight text-violet-900">
                      {reportPeriod}
                    </span>
                  </span>
                </>
              )}
            </div>
            <p className="mt-1.5 max-w-2xl text-sm font-medium text-ink-muted">
              {hasWoltSummary ? t("dashboard.subtitleInvoice") : t("dashboard.subtitleOrders")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="analytics-pill border-slate-200 bg-white text-ink-muted">
              <span className="font-mono font-semibold text-ink">
                {summary.delivered_order_count ?? 0}
              </span>{" "}
              {t("dashboard.delivered")}
            </span>
            <span className="analytics-pill border-slate-200 bg-white text-ink-muted">
              <span className="font-mono font-semibold text-ink">
                {summary.matched_count}
              </span>
              <span className="text-ink-faint">/{summary.row_count}</span> {t("dashboard.matched")}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-8">
        {/* 4 main KPI tabs — sequential cascade */}
        <div id="period-totals" className="analytics-section scroll-mt-24 border-indigo-100/80 bg-gradient-to-b from-white/90 to-indigo-50/20">
          <SectionHeader
            title={t("dashboard.periodTotals")}
            subtitle={t("dashboard.periodTotalsHint")}
            accent="bg-gradient-to-b from-indigo-500 to-violet-400"
          />
          <MainHeroCascade
            steps={heroSteps}
            onComplete={onHeroCascadeComplete}
            uploadLabel={t("common.uploadStandardSummary")}
          />
        </div>

        {/* Money flow */}
        {hasWoltSummary && soldTotal > 0 && (
          <div
            style={{ animationDelay: "120ms" }}
            className="analytics-section animate-fade-up opacity-0"
          >
            <SectionHeader
              title={t("dashboard.moneyFlow")}
              subtitle={t("dashboard.moneyFlowHint")}
              accent="bg-gradient-to-b from-slate-500 to-slate-300"
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
              <FlowStep
                label={t("dashboard.goodsSold")}
                value={formatIls(soldTotal)}
                pctWidth={100}
                color="bg-slate-500"
              />
              <span className="hidden shrink-0 pb-1 text-slate-300 sm:block">−</span>
              <FlowStep
                label={t("dashboard.woltExpenses")}
                value={formatIls(woltExpenses)}
                pctWidth={pct(woltExpenses, soldTotal)}
                color="bg-orange-500"
              />
              <span className="hidden shrink-0 pb-1 text-slate-300 sm:block">=</span>
              <FlowStep
                label={t("dashboard.payout")}
                value={formatIls(payout)}
                pctWidth={pct(payout ?? 0, soldTotal)}
                color="bg-sky-500"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-4 text-xs font-medium text-ink-faint">
              <span>{t("dashboard.selfCostCogs", { amount: formatIls(selfCost) })}</span>
              <span>{t("dashboard.netAfterCogs", { amount: formatIls(woltNetIncome) })}</span>
            </div>
          </div>
        )}

        {/* Metric grids */}
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <div className="analytics-section h-full">
              <SectionHeader
                title={t("dashboard.revenue")}
                subtitle={t("dashboard.revenueHint")}
                accent="bg-gradient-to-b from-slate-600 to-slate-400"
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <MetricTile
                  label={t("dashboard.actualSoldTotal")}
                  hint={hasWoltSummary ? t("dashboard.actualSoldHintInvoice") : t("dashboard.actualSoldHintOrders")}
                  value={soldTotal}
                  tone="neutral"
                  delay={160}
                />
                <MetricTile
                  label={t("dashboard.menuListValue")}
                  hint={t("dashboard.menuListHint")}
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
                title={t("dashboard.woltCosts")}
                subtitle={t("dashboard.woltCostsHint")}
                accent="bg-gradient-to-b from-orange-500 to-amber-400"
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {hasWoltSummary ? (
                  <>
                    <MetricTile
                      label={t("dashboard.expensesBeforeVat")}
                      hint={t("dashboard.expensesBeforeVatHint")}
                      value={summary.wolt_summary_expenses_net}
                      tone="amber"
                      delay={240}
                    />
                    <MetricTile
                      label={t("dashboard.expensesInclVat")}
                      hint={
                        selfBillingNegative > 0
                          ? t("dashboard.expensesInclVatHintSplit", {
                              invoice: formatIls(woltInvoiceOnly),
                              selfBilling: formatIls(selfBillingNegative),
                            })
                          : t("dashboard.expensesInclVatHint")
                      }
                      value={summary.wolt_summary_expenses_incl_vat}
                      tone="orange"
                      delay={280}
                    />
                  </>
                ) : (
                  <>
                    <MetricTile
                      label={t("dashboard.commissionBeforeVat")}
                      value={summary.total_commission_before_vat}
                      tone="amber"
                      delay={240}
                    />
                    <MetricTile
                      label={t("dashboard.commissionInclVat")}
                      hint={t("dashboard.commissionInclVatHint")}
                      value={summary.total_commission_with_vat}
                      tone="orange"
                      delay={280}
                    />
                  </>
                )}
                <MetricTile
                  label={t("dashboard.productSelfCost")}
                  hint={t("dashboard.productSelfCostHint")}
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
                title={t("dashboard.perItemGap")}
                subtitle={t("dashboard.perItemGapHint")}
                accent="bg-gradient-to-b from-rose-500 to-pink-400"
              />
              {hasWoltSummary && excludedDisplay != null ? (
                <>
                  <div
                    style={{ animationDelay: "360ms" }}
                    className="animate-fade-up opacity-0 rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white p-4"
                  >
                    <p className="analytics-label text-rose-700/80">{t("dashboard.stillExcluded")}</p>
                    <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-rose-800">
                      <CountUpCurrency value={excludedDisplay} durationMs={1100} />
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-rose-900/70">
                      {includeAllocatedAdCost
                        ? t("dashboard.excludedAfterAds")
                        : t("dashboard.excludedEnableAds")}
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
                  <p className="text-sm font-semibold text-ink-muted">{t("dashboard.noGapTitle")}</p>
                  <p className="mt-1 text-xs text-ink-faint">{t("dashboard.noGapHint")}</p>
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
            {t("dashboard.dataQuality")}{" "}
            <span className="font-mono text-ink">{summary.matched_count}</span>/
            {summary.row_count} {t("dashboard.productsMatched")}
          </span>
          {(summary.rejected_order_count ?? 0) > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-violet-300" />
              <span className="text-violet-700">
                {t("dashboard.rejectedExcluded", { count: summary.rejected_order_count ?? 0 })}
              </span>
            </>
          )}
          {hasWoltSummary && selfBillingNegative > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-amber-300" />
              <span className="text-amber-800">
                {t("dashboard.selfBillingOnExpenses", { amount: formatIls(selfBillingNegative) })}
              </span>
            </>
          )}
          {hasWoltSummary && includeAllocatedAdCost && adAllocated > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-sky-300" />
              <span className="text-sky-800">
                {t("dashboard.adCostOnRows", { amount: formatIls(adAllocated) })}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
