/**
 * Side-by-side period totals — the same 4 headline KPIs as Dashboard hero cascade.
 */

import { useEffect, useMemo, useState } from "react";
import { CountUpCurrency } from "./CountUpCurrency";
import { useI18n } from "../i18n/LanguageContext";
import type { CalculationSummary } from "../types";
import { computeHeroMetrics, sumHeroMetrics, type HeroMetrics } from "../utils/heroMetrics";

export interface ComparisonEntry {
  timelineId: string;
  periodDate: string;
  summary: CalculationSummary | null;
  loading: boolean;
  error?: string;
}

interface MetricCardDef {
  stepNumber: number;
  label: string;
  hint: string;
  value: number | null | undefined;
  cardClass: string;
  indexClass: string;
  valueClass: string;
}

interface MetricCardProps extends MetricCardDef {
  uploadLabel: string;
  summaryAccent?: boolean;
}

function MetricCard({
  stepNumber,
  label,
  hint,
  value,
  cardClass,
  indexClass,
  valueClass,
  uploadLabel,
  summaryAccent = false,
}: MetricCardProps) {
  return (
    <article
      className={`compare-metric-card ${
        summaryAccent
          ? "border border-indigo-300/90 bg-gradient-to-r from-indigo-100 via-white to-violet-100 shadow-md shadow-indigo-500/10"
          : cardClass
      }`}
    >
      <span className={`hero-cascade-index ${indexClass}`}>
        {String(stepNumber).padStart(2, "0")}
      </span>
      <h4 className="mt-2 line-clamp-2 min-h-[2.5rem] font-display text-sm font-semibold leading-snug tracking-tight text-ink">
        {label}
      </h4>
      <p className="compare-metric-hint">{hint}</p>
      <p
        className={`mt-auto pt-3 font-mono text-xl font-semibold tabular-nums tracking-tight sm:text-2xl ${valueClass}`}
      >
        {value != null && !Number.isNaN(value) ? (
          <CountUpCurrency value={value} durationMs={900} />
        ) : (
          <span className="text-sm sm:text-base">{uploadLabel}</span>
        )}
      </p>
    </article>
  );
}

function buildMetricCards(
  metrics: HeroMetrics,
  t: (key: string, params?: Record<string, string | number>) => string,
  hintSuffix?: string,
): MetricCardDef[] {
  const { hasWoltSummary } = metrics;
  const extraHint = hintSuffix ? ` · ${hintSuffix}` : "";

  return [
    {
      stepNumber: 1,
      label: t("dashboard.heroGoodsSold"),
      hint:
        (hasWoltSummary ? t("dashboard.heroGoodsHintInvoice") : t("dashboard.heroGoodsHintOrders")) +
        extraHint,
      value: metrics.soldTotal,
      cardClass: "border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-100/80",
      indexClass: "text-slate-500",
      valueClass: "text-ink",
    },
    {
      stepNumber: 2,
      label: t("dashboard.heroWoltExpenses"),
      hint:
        (hasWoltSummary ? t("dashboard.heroWoltHintInvoice") : t("dashboard.heroWoltHintOrders")) +
        extraHint,
      value: metrics.woltExpenses,
      cardClass: "border-orange-200/90 bg-gradient-to-br from-orange-50 via-white to-amber-50/80",
      indexClass: "text-orange-600",
      valueClass: "text-orange-800",
    },
    {
      stepNumber: 3,
      label: t("dashboard.heroPayout"),
      hint: t("dashboard.heroPayoutHint") + extraHint,
      value: metrics.payout,
      cardClass: "border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-indigo-50/80",
      indexClass: "text-sky-600",
      valueClass: "text-sky-800",
    },
    {
      stepNumber: 4,
      label: t("dashboard.heroStoryNet"),
      hint:
        (hasWoltSummary ? t("dashboard.heroStoryHintInvoice") : t("dashboard.heroStoryHintOrders")) +
        extraHint,
      value: metrics.headlineNet,
      cardClass: "border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80",
      indexClass: "text-emerald-600",
      valueClass: "text-emerald-700",
    },
  ];
}

function PeriodHeader({ periodDate }: { periodDate: string }) {
  const { t } = useI18n();
  return (
    <div className="compare-col-header border border-violet-200/90 bg-gradient-to-r from-violet-50 via-white to-indigo-50">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">
        {t("compare.period")}
      </p>
      <p className="mt-1 line-clamp-2 font-mono text-base font-bold tabular-nums tracking-tight text-violet-950">
        {periodDate}
      </p>
    </div>
  );
}

function SummaryHeader({ title }: { title: string }) {
  return (
    <div className="compare-col-header border border-indigo-300/90 bg-gradient-to-r from-indigo-100 via-white to-violet-100 shadow-md shadow-indigo-500/10">
      <p className="line-clamp-3 font-display text-sm font-bold leading-snug tracking-tight text-indigo-950">
        {title}
      </p>
    </div>
  );
}

function ComparisonColumn({
  entry,
  uploadLabel,
}: {
  entry: ComparisonEntry;
  uploadLabel: string;
}) {
  const { t } = useI18n();

  if (entry.loading) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <div className="compare-col-header animate-pulse border border-indigo-200/80 bg-white/80" />
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="compare-metric-card animate-pulse border-slate-200/80 bg-slate-100"
          />
        ))}
        <p className="text-center text-xs font-semibold text-ink-faint">{t("compare.loading")}</p>
      </div>
    );
  }

  if (entry.error || !entry.summary) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <div className="compare-col-header border border-red-200 bg-red-50/80">
          <p className="line-clamp-2 text-sm font-bold text-red-800">{entry.periodDate}</p>
        </div>
        <div className="compare-metric-card flex items-center justify-center border-red-200 bg-red-50/60 text-center">
          <p className="px-3 text-xs font-medium text-red-700">
            {entry.error ?? t("compare.loadFailed")}
          </p>
        </div>
        {[2, 3, 4].map((n) => (
          <div key={n} className="compare-metric-card invisible border-transparent" aria-hidden />
        ))}
      </div>
    );
  }

  const cards = buildMetricCards(computeHeroMetrics(entry.summary), t);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PeriodHeader periodDate={entry.periodDate} />
      {cards.map((card) => (
        <MetricCard key={card.stepNumber} {...card} uploadLabel={uploadLabel} />
      ))}
    </div>
  );
}

function SummaryColumn({
  entries,
  uploadLabel,
  visible,
}: {
  entries: ComparisonEntry[];
  uploadLabel: string;
  visible: boolean;
}) {
  const { t } = useI18n();

  const summaries = entries
    .map((entry) => entry.summary)
    .filter((summary): summary is CalculationSummary => summary != null);

  const metrics = useMemo(() => sumHeroMetrics(summaries), [summaries]);
  const summaryHint = t("compare.summaryHint", { count: summaries.length });
  const cards = buildMetricCards(metrics, t, summaryHint);

  const dateFrom = entries[0]?.periodDate ?? "—";
  const dateTo = entries[entries.length - 1]?.periodDate ?? "—";
  const title = t("compare.summaryTitle", { from: dateFrom, to: dateTo });

  if (!visible) return null;

  return (
    <div className="animate-fade-up flex min-w-0 flex-col gap-3 opacity-0">
      <SummaryHeader title={title} />
      {cards.map((card) => (
        <MetricCard key={card.stepNumber} {...card} uploadLabel={uploadLabel} summaryAccent />
      ))}
    </div>
  );
}

interface PeriodTotalsComparisonProps {
  entries: ComparisonEntry[];
  embedded?: boolean;
}

export function PeriodTotalsComparison({ entries, embedded = false }: PeriodTotalsComparisonProps) {
  const { t } = useI18n();
  const uploadLabel = t("common.uploadStandardSummary");
  const [showSummary, setShowSummary] = useState(false);

  const allPeriodsReady =
    entries.length >= 2 &&
    entries.every((entry) => !entry.loading && entry.summary != null && !entry.error);

  const entriesKey = entries.map((entry) => `${entry.timelineId}:${entry.loading}`).join("|");

  useEffect(() => {
    setShowSummary(false);
    if (!allPeriodsReady) return;
    const timer = window.setTimeout(() => setShowSummary(true), 480);
    return () => window.clearTimeout(timer);
  }, [allPeriodsReady, entriesKey]);

  const columnCount = entries.length + (showSummary ? 1 : 0);

  const wrapperClass = embedded
    ? ""
    : "analytics-section border-indigo-100/80 bg-gradient-to-b from-white/90 to-indigo-50/20";

  return (
    <div id="period-totals-comparison" className={`scroll-mt-28 ${wrapperClass}`}>
      {!embedded && (
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-violet-400" />
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
              {t("dashboard.periodTotals")}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-ink-faint sm:text-sm">
              {t("compare.subtitle", { count: entries.length })}
            </p>
          </div>
        </div>
      )}

      <div
        className="compare-totals-grid"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {entries.map((entry) => (
          <ComparisonColumn key={entry.timelineId} entry={entry} uploadLabel={uploadLabel} />
        ))}
        {showSummary && (
          <SummaryColumn entries={entries} uploadLabel={uploadLabel} visible={showSummary} />
        )}
      </div>
    </div>
  );
}
