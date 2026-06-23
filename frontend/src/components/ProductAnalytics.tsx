/**
 * Product performance analytics — per-period and all-time rankings.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchOverallAnalytics, fetchPeriodAnalytics } from "../api/client";
import { useI18n } from "../i18n/LanguageContext";
import type {
  OverallAnalyticsResponse,
  OverallProductMetric,
  PeriodAnalyticsResponse,
  PeriodProductMetric,
  ReportTimeline,
} from "../types";

type AnalyticsMode = "period" | "overall";

interface ProductAnalyticsProps {
  timelines: ReportTimeline[];
  activeTimelineId: string | null;
  databaseConfigured: boolean;
}

function formatIls(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function PeriodRankingTable({
  title,
  rows,
  showGrowth = false,
}: {
  title: string;
  rows: PeriodProductMetric[];
  showGrowth?: boolean;
}) {
  const { t } = useI18n();
  if (rows.length === 0) return null;

  return (
    <div className="modern-panel overflow-hidden">
      <div className="border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
        <h3 className="text-sm font-bold text-ink sm:text-base">{title}</h3>
      </div>
      <div className="table-scroll max-h-80">
        <table className="w-full text-start text-sm">
          <thead>
            <tr>
              <th className="table-sticky-th">#</th>
              <th className="table-sticky-th">{t("analytics.product")}</th>
              <th className="table-sticky-th">{t("analytics.qty")}</th>
              <th className="table-sticky-th">{t("analytics.revenue")}</th>
              <th className="table-sticky-th">{t("analytics.profit")}</th>
              <th className="table-sticky-th">{t("analytics.velocity")}</th>
              {showGrowth && (
                <th className="table-sticky-th">{t("analytics.growth")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.product_key} className="border-t border-slate-100">
                <td className="table-cell tabular-nums text-ink-faint">{index + 1}</td>
                <td className="table-cell-wrap font-semibold" title={row.item_name}>
                  {row.item_name}
                </td>
                <td className="table-cell tabular-nums">{row.total_quantity}</td>
                <td className="table-cell tabular-nums">{formatIls(row.total_revenue)}</td>
                <td className="table-cell tabular-nums text-emerald-800">
                  {row.has_profit_data ? formatIls(row.total_net_profit) : "—"}
                </td>
                <td className="table-cell tabular-nums">{row.sales_velocity.toFixed(2)}</td>
                {showGrowth && (
                  <td
                    className={`table-cell tabular-nums font-semibold ${
                      (row.growth_revenue_pct ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatPct(row.growth_revenue_pct)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverallRankingTable({
  title,
  rows,
  showPenetration = false,
  showConsistency = false,
}: {
  title: string;
  rows: OverallProductMetric[];
  showPenetration?: boolean;
  showConsistency?: boolean;
}) {
  const { t } = useI18n();
  if (rows.length === 0) return null;

  return (
    <div className="modern-panel overflow-hidden">
      <div className="border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
        <h3 className="text-sm font-bold text-ink sm:text-base">{title}</h3>
      </div>
      <div className="table-scroll max-h-80">
        <table className="w-full text-start text-sm">
          <thead>
            <tr>
              <th className="table-sticky-th">#</th>
              <th className="table-sticky-th">{t("analytics.product")}</th>
              <th className="table-sticky-th">{t("analytics.qty")}</th>
              <th className="table-sticky-th">{t("analytics.revenue")}</th>
              <th className="table-sticky-th">{t("analytics.profit")}</th>
              {showPenetration && (
                <th className="table-sticky-th">{t("analytics.penetration")}</th>
              )}
              {showConsistency && (
                <th className="table-sticky-th">{t("analytics.consistency")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.product_key} className="border-t border-slate-100">
                <td className="table-cell tabular-nums text-ink-faint">{index + 1}</td>
                <td className="table-cell-wrap font-semibold" title={row.item_name}>
                  {row.item_name}
                </td>
                <td className="table-cell tabular-nums">{row.lifetime_quantity}</td>
                <td className="table-cell tabular-nums">{formatIls(row.lifetime_revenue)}</td>
                <td className="table-cell tabular-nums text-emerald-800">
                  {row.has_profit_data ? formatIls(row.lifetime_profit) : "—"}
                </td>
                {showPenetration && (
                  <td className="table-cell tabular-nums">
                    {row.order_penetration_pct.toFixed(1)}%
                  </td>
                )}
                {showConsistency && (
                  <td className="table-cell tabular-nums">{row.consistency_score}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductAnalytics({
  timelines,
  activeTimelineId,
  databaseConfigured,
}: ProductAnalyticsProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<AnalyticsMode>("overall");
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(activeTimelineId);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodData, setPeriodData] = useState<PeriodAnalyticsResponse | null>(null);
  const [overallData, setOverallData] = useState<OverallAnalyticsResponse | null>(null);

  useEffect(() => {
    if (activeTimelineId) {
      setSelectedTimelineId(activeTimelineId);
    }
  }, [activeTimelineId]);

  const loadAnalytics = useCallback(async () => {
    if (!databaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "period") {
        if (!selectedTimelineId) {
          setPeriodData(null);
          return;
        }
        const data = await fetchPeriodAnalytics(selectedTimelineId, { limit });
        setPeriodData(data);
      } else {
        const data = await fetchOverallAnalytics({ limit });
        setOverallData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("analytics.loadFailed"));
      setPeriodData(null);
      setOverallData(null);
    } finally {
      setLoading(false);
    }
  }, [databaseConfigured, mode, selectedTimelineId, limit, t]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (!databaseConfigured) {
    return null;
  }

  return (
    <section id="product-analytics" className="analytics-shell scroll-mt-28">
      <div className="border-b border-slate-200/70 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="analytics-pill border-violet-200/80 bg-violet-50 text-violet-800">
              {t("analytics.badge")}
            </span>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t("analytics.title")}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm font-medium text-ink-muted">
              {t("analytics.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="modern-panel flex gap-1 p-1">
              <button
                type="button"
                onClick={() => setMode("period")}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  mode === "period"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
                    : "text-ink-muted hover:bg-slate-50"
                }`}
              >
                {t("analytics.modePeriod")}
              </button>
              <button
                type="button"
                onClick={() => setMode("overall")}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  mode === "overall"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
                    : "text-ink-muted hover:bg-slate-50"
                }`}
              >
                {t("analytics.modeOverall")}
              </button>
            </div>

            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === "period" && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              {t("analytics.selectPeriod")}
            </label>
            <select
              value={selectedTimelineId ?? ""}
              onChange={(e) => setSelectedTimelineId(e.target.value || null)}
              className="min-w-[14rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              <option value="">{t("analytics.pickTimeline")}</option>
              {timelines.map((timeline) => (
                <option key={timeline.id} value={timeline.id}>
                  {timeline.period_label}
                </option>
              ))}
            </select>
            {periodData && (
              <span className="text-xs font-medium text-ink-faint">
                {t("analytics.periodMeta", {
                  days: periodData.period_days,
                  count: periodData.product_count,
                })}
              </span>
            )}
          </div>
        )}

        {mode === "overall" && overallData && (
          <p className="mt-4 text-xs font-medium text-ink-faint">
            {t("analytics.overallMeta", {
              timelines: overallData.timeline_count,
              products: overallData.product_count,
            })}
          </p>
        )}
      </div>

      <div className="space-y-6 p-5 sm:p-8">
        {loading && (
          <p className="text-center text-sm font-semibold text-ink-muted">{t("analytics.loading")}</p>
        )}
        {error && (
          <div className="modern-panel border-red-200 bg-red-50/90 px-5 py-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {!loading && mode === "period" && periodData && (
          <div className="grid gap-6 xl:grid-cols-2">
            <PeriodRankingTable
              title={t("analytics.rankTopQuantity")}
              rows={periodData.rankings.top_quantity}
            />
            <PeriodRankingTable
              title={t("analytics.rankTopRevenue")}
              rows={periodData.rankings.top_revenue}
            />
            <PeriodRankingTable
              title={t("analytics.rankTopProfit")}
              rows={periodData.rankings.top_profit}
            />
            <PeriodRankingTable
              title={t("analytics.rankFastestGrowing")}
              rows={periodData.rankings.fastest_growing}
              showGrowth
            />
          </div>
        )}

        {!loading && mode === "period" && !selectedTimelineId && !error && (
          <p className="text-center text-sm font-medium text-ink-muted">
            {t("analytics.pickTimeline")}
          </p>
        )}

        {!loading && mode === "overall" && overallData && (
          <div className="grid gap-6 xl:grid-cols-2">
            <OverallRankingTable
              title={t("analytics.rankTopProfit")}
              rows={overallData.rankings.top_profit}
            />
            <OverallRankingTable
              title={t("analytics.rankTopRevenue")}
              rows={overallData.rankings.top_revenue}
            />
            <OverallRankingTable
              title={t("analytics.rankTopQuantity")}
              rows={overallData.rankings.top_quantity}
            />
            <OverallRankingTable
              title={t("analytics.rankTopPenetration")}
              rows={overallData.rankings.top_penetration}
              showPenetration
            />
            <OverallRankingTable
              title={t("analytics.rankMostConsistent")}
              rows={overallData.rankings.most_consistent}
              showConsistency
            />
          </div>
        )}
      </div>
    </section>
  );
}
