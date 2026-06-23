import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logoutAdmin, verifySession } from "./api/auth";
import { calculateNetIncome, deleteReportTimeline, fetchReportTimeline, fetchReportTimelines } from "./api/client";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";
import { MissingCommissionPanel } from "./components/MissingCommissionPanel";
import { LossItemsTable, countLossItems } from "./components/LossItemsTable";
import { LossOutcomeBanner } from "./components/LossOutcomeBanner";
import { OrdersTable } from "./components/OrdersTable";
import { ResultsTable } from "./components/ResultsTable";
import { TimelinePicker } from "./components/TimelinePicker";
import { DeleteTimelineConfirmDialog } from "./components/DeleteTimelineConfirmDialog";
import { LanguageToggle } from "./components/LanguageToggle";
import { UploadPanel } from "./components/UploadPanel";
import { PeriodTotalsComparison, type ComparisonEntry } from "./components/PeriodTotalsComparison";
import { ProductAnalytics } from "./components/ProductAnalytics";
import { AppNavbar, type AppView } from "./components/AppNavbar";
import { UploadSuccessCard } from "./components/UploadSuccessCard";
import { getAuthUsername, hasAuthSession } from "./auth/session";
import { useI18n } from "./i18n/LanguageContext";
import { WelcomeSplash } from "./components/WelcomeSplash";
import { formatReportPeriod, formatTimelinePeriod } from "./utils/formatReportPeriod";
import type { CalculationResponse, CalculationSummary, ReportTimeline, UploadFiles } from "./types";

type TabId = "orders" | "products" | "losses";
type AuthState = "checking" | "guest" | "welcoming" | "authenticated";

function parseViewFromUrl(): AppView {
  const param = new URLSearchParams(window.location.search).get("view");
  if (param === "uploads" || param === "report" || param === "analytics") {
    return param;
  }
  return "reports";
}

/** Smooth vertical scroll only — avoids horizontal page drift from scrollIntoView inline. */
function scrollToElementVertically(
  element: HTMLElement,
  block: ScrollLogicalPosition = "center",
) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  let targetTop = rect.top + window.scrollY;

  if (block === "center") {
    targetTop -= (viewportHeight - rect.height) / 2;
  } else if (block === "end") {
    targetTop -= viewportHeight - rect.height;
  }

  window.scrollTo({ top: Math.max(0, targetTop), left: window.scrollX, behavior: "smooth" });
}

export default function App() {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>(
    hasAuthSession() ? "checking" : "guest",
  );
  const [result, setResult] = useState<CalculationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadFiles>({
    orderNumbers: null,
    itemsSold: null,
    paymentDetails: null,
  });
  const [activeTab, setActiveTab] = useState<TabId>("orders");
  const [includeAllocatedAdCost, setIncludeAllocatedAdCost] = useState(false);
  const [showLossBanner, setShowLossBanner] = useState(false);
  const [highlightLossesTab, setHighlightLossesTab] = useState(false);
  const [timelines, setTimelines] = useState<ReportTimeline[]>([]);
  const [timelinesLoading, setTimelinesLoading] = useState(false);
  const [databaseConfigured, setDatabaseConfigured] = useState(false);
  const [activeTimelineId, setActiveTimelineId] = useState<string | null>(null);
  const [loadingTimelineId, setLoadingTimelineId] = useState<string | null>(null);
  const [deletingTimelineId, setDeletingTimelineId] = useState<string | null>(null);
  const [deletePendingTimeline, setDeletePendingTimeline] = useState<ReportTimeline | null>(null);
  const [compareTimelineIds, setCompareTimelineIds] = useState<string[]>([]);
  const [compareSummaryCache, setCompareSummaryCache] = useState<
    Record<string, CalculationSummary>
  >({});
  const [compareLoadingIds, setCompareLoadingIds] = useState<Set<string>>(new Set());
  const [compareErrors, setCompareErrors] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<AppView>(parseViewFromUrl);
  const [uploadSuccessPeriodLabel, setUploadSuccessPeriodLabel] = useState<string | null>(null);
  const [uploadJustSucceeded, setUploadJustSucceeded] = useState(false);
  const tabsBarRef = useRef<HTMLDivElement>(null);
  const lossBannerRef = useRef<HTMLDivElement>(null);
  const resultGenerationRef = useRef(0);
  const lossSequenceTimersRef = useRef<number[]>([]);

  function clearLossSequenceTimers() {
    lossSequenceTimersRef.current.forEach((id) => window.clearTimeout(id));
    lossSequenceTimersRef.current = [];
  }

  function scheduleLossSequenceTimer(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    lossSequenceTimersRef.current.push(id);
  }

  useEffect(() => {
    if (authState !== "checking") return;
    let cancelled = false;
    void verifySession().then((ok) => {
      if (!cancelled) setAuthState(ok ? "authenticated" : "guest");
    });
    return () => {
      cancelled = true;
    };
  }, [authState]);

  const refreshTimelines = useCallback(async () => {
    setTimelinesLoading(true);
    try {
      const { timelines: list, database_configured } = await fetchReportTimelines();
      setTimelines(list);
      setDatabaseConfigured(database_configured);
    } catch {
      setTimelines([]);
      setDatabaseConfigured(false);
    } finally {
      setTimelinesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    void refreshTimelines();
  }, [authState, refreshTimelines]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeView === "reports") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", activeView);
    }
    window.history.replaceState({}, "", url);
  }, [activeView]);

  useEffect(() => {
    if (activeView === "report" && !result) {
      setActiveView("reports");
    }
  }, [activeView, result]);

  const reportPeriodLabel = useMemo(() => {
    if (!result) return null;
    if (activeTimelineId) {
      const timeline = timelines.find((item) => item.id === activeTimelineId);
      if (timeline) return formatTimelinePeriod(timeline);
    }
    return formatReportPeriod(result.summary);
  }, [result, activeTimelineId, timelines]);

  function handleNavigate(view: AppView) {
    if (view === "report" && !result) return;
    if (view === "analytics" && !databaseConfigured) return;
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const comparisonEntries = useMemo((): ComparisonEntry[] => {
    const entries: Array<ComparisonEntry & { sortKey: string }> = [];

    for (const id of compareTimelineIds) {
      const timeline = timelines.find((item) => item.id === id);
      if (!timeline) continue;
      entries.push({
        timelineId: id,
        periodDate: formatTimelinePeriod(timeline),
        summary: compareSummaryCache[id] ?? null,
        loading: compareLoadingIds.has(id),
        error: compareErrors[id],
        sortKey: timeline.period_start ?? timeline.created_at ?? "",
      });
    }

    entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return entries.map(({ sortKey: _ignored, ...entry }) => entry);
  }, [
    compareTimelineIds,
    timelines,
    compareSummaryCache,
    compareLoadingIds,
    compareErrors,
  ]);

  const showComparison = comparisonEntries.length >= 2;

  useEffect(() => {
    if (!showComparison || activeView !== "reports") return;
    const timer = window.setTimeout(() => {
      document.getElementById("period-totals-comparison")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [showComparison, comparisonEntries.length, activeView]);

  const handleToggleCompare = useCallback(
    async (timelineId: string) => {
      if (compareTimelineIds.includes(timelineId)) {
        setCompareTimelineIds((prev) => prev.filter((id) => id !== timelineId));
        setCompareErrors((prev) => {
          const next = { ...prev };
          delete next[timelineId];
          return next;
        });
        return;
      }

      setCompareTimelineIds((prev) => [...prev, timelineId]);

      if (compareSummaryCache[timelineId]) return;

      setCompareLoadingIds((prev) => new Set(prev).add(timelineId));
      setCompareErrors((prev) => {
        const next = { ...prev };
        delete next[timelineId];
        return next;
      });

      try {
        const response = await fetchReportTimeline(timelineId);
        setCompareSummaryCache((prev) => ({
          ...prev,
          [timelineId]: response.summary,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setCompareErrors((prev) => ({ ...prev, [timelineId]: message }));
        setCompareTimelineIds((prev) => prev.filter((id) => id !== timelineId));
        if (message.includes("sign in again")) {
          setAuthState("guest");
        }
      } finally {
        setCompareLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(timelineId);
          return next;
        });
      }
    },
    [compareTimelineIds, compareSummaryCache],
  );

  function applyDashboardResult(
    response: CalculationResponse,
    timelineId: string | null,
  ) {
    resultGenerationRef.current += 1;
    clearLossSequenceTimers();
    setResult(response);
    setActiveTimelineId(timelineId);
    setIncludeAllocatedAdCost(false);
    setShowLossBanner(false);
    setHighlightLossesTab(false);
    setActiveTab(response.orders.length > 0 ? "orders" : "products");
  }

  function handleRequestDeleteTimeline(timelineId: string) {
    const timeline = timelines.find((t) => t.id === timelineId);
    if (timeline) {
      setDeletePendingTimeline(timeline);
    }
  }

  function handleCancelDeleteTimeline() {
    if (!deletingTimelineId) {
      setDeletePendingTimeline(null);
    }
  }

  async function handleConfirmDeleteTimeline() {
    if (!deletePendingTimeline) return;

    const timelineId = deletePendingTimeline.id;
    setDeletingTimelineId(timelineId);
    setError(null);
    try {
      await deleteReportTimeline(timelineId);
      if (activeTimelineId === timelineId) {
        setResult(null);
        setActiveTimelineId(null);
        setActiveView("reports");
      }
      setCompareTimelineIds((prev) => prev.filter((id) => id !== timelineId));
      setCompareSummaryCache((prev) => {
        const next = { ...prev };
        delete next[timelineId];
        return next;
      });
      setDeletePendingTimeline(null);
      await refreshTimelines();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      if (message.includes("sign in again")) {
        setAuthState("guest");
        setDeletePendingTimeline(null);
      }
    } finally {
      setDeletingTimelineId(null);
    }
  }

  async function handleSelectTimeline(timelineId: string) {
    if (activeTimelineId === timelineId && result) {
      resultGenerationRef.current += 1;
      clearLossSequenceTimers();
      setResult(null);
      setActiveTimelineId(null);
      setError(null);
      setIncludeAllocatedAdCost(false);
      setShowLossBanner(false);
      setHighlightLossesTab(false);
      setActiveView("reports");
      return;
    }

    setLoadingTimelineId(timelineId);
    setError(null);
    try {
      const response = await fetchReportTimeline(timelineId);
      applyDashboardResult(response, timelineId);
      setActiveView("report");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      if (message.includes("sign in again")) {
        setAuthState("guest");
      }
    } finally {
      setLoadingTimelineId(null);
    }
  }

  const lossItemCount = result
    ? countLossItems(result.orders, includeAllocatedAdCost)
    : 0;

  const handleHeroCascadeComplete = useCallback(() => {
    if (!result) return;

    const generation = resultGenerationRef.current;
    const lossesOnLoad = countLossItems(result.orders, false);

    clearLossSequenceTimers();
    setShowLossBanner(true);

    scheduleLossSequenceTimer(() => {
      if (resultGenerationRef.current !== generation) return;
      if (lossBannerRef.current) {
        scrollToElementVertically(lossBannerRef.current, "center");
      }
    }, 120);

    if (lossesOnLoad <= 0) return;

    scheduleLossSequenceTimer(() => {
      if (resultGenerationRef.current !== generation) return;
      setHighlightLossesTab(true);
      if (tabsBarRef.current) {
        scrollToElementVertically(tabsBarRef.current, "center");
      }
    }, 1600);

    scheduleLossSequenceTimer(() => {
      if (resultGenerationRef.current !== generation) return;
      setHighlightLossesTab(false);
    }, 20000);
  }, [result]);

  useEffect(() => {
    return () => clearLossSequenceTimers();
  }, []);

  useEffect(() => {
    if (activeTab === "losses") {
      setHighlightLossesTab(false);
    }
  }, [activeTab]);

  function handleLogout() {
    logoutAdmin();
    setResult(null);
    setError(null);
    setAuthState("guest");
  }

  async function handleCalculateFromUploads() {
    if (!files.orderNumbers || !files.paymentDetails) return;

    setLoading(true);
    setError(null);
    setUploadJustSucceeded(false);
    setUploadSuccessPeriodLabel(null);

    try {
      const response = await calculateNetIncome({
        orderNumbersCsvText: await files.orderNumbers.text(),
        paymentDetailsCsvText: await files.paymentDetails.text(),
        orderNumbersFileName: files.orderNumbers.name,
        paymentDetailsFileName: files.paymentDetails.name,
      });

      setUploadSuccessPeriodLabel(formatReportPeriod(response.summary));
      setUploadJustSucceeded(true);
      setFiles({
        orderNumbers: null,
        itemsSold: null,
        paymentDetails: null,
      });
      void refreshTimelines();
      window.setTimeout(() => void refreshTimelines(), 2500);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      if (message.includes("sign in again")) {
        setAuthState("guest");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoToReportsFromUpload() {
    setUploadJustSucceeded(false);
    setUploadSuccessPeriodLabel(null);
    setActiveView("reports");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleUploadAnother() {
    setUploadJustSucceeded(false);
    setUploadSuccessPeriodLabel(null);
    setFiles({
      orderNumbers: null,
      itemsSold: null,
      paymentDetails: null,
    });
  }

  if (authState === "checking") {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center">
        <p className="text-base font-bold text-ink-muted">{t("app.checkingSession")}</p>
      </div>
    );
  }

  if (authState === "guest") {
    return <LoginPage onSuccess={() => setAuthState("welcoming")} />;
  }

  if (authState === "welcoming") {
    return <WelcomeSplash onComplete={() => setAuthState("authenticated")} />;
  }

  const adminName = getAuthUsername() ?? "admin";
  const hasWoltSummary = result?.summary.wolt_summary_gross_goods != null;
  const canAllocateAds = (result?.summary.wolt_summary_ad_campaigns_incl_vat ?? 0) > 0;

  return (
    <div className="page-shell">
      <div className="orb -left-32 top-0 h-96 w-96 animate-orb-float bg-indigo-400/20" />
      <div
        className="orb right-0 top-1/4 h-[28rem] w-[28rem] animate-orb-float bg-sky-300/18"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="orb bottom-0 left-1/3 h-80 w-80 animate-orb-float bg-violet-400/14"
        style={{ animationDelay: "-12s" }}
      />
      <div
        className="orb right-1/4 top-2/3 h-64 w-64 animate-orb-float bg-amber-200/20"
        style={{ animationDelay: "-18s" }}
      />

      <header className="relative border-b border-white/50 bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="brand-title">Story Phone</h1>
              <span className="font-display text-base font-semibold italic tracking-wide text-violet-600 sm:text-lg">
                — From Dato
              </span>
            </div>
            <p className="mt-2 text-sm font-bold tracking-wide text-ink-muted sm:text-base">
              {t("app.dashboardTitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            {result && activeView === "report" && (
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 sm:flex sm:px-4 sm:py-2">
                <span className="h-2 w-2 animate-shimmer rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-emerald-800">
                  {activeTimelineId ? t("app.savedReport") : t("app.liveResults")}
                </span>
              </div>
            )}
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-muted sm:px-4 sm:py-2 sm:text-sm">
              {adminName}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:px-4 sm:py-2 sm:text-sm"
            >
              {t("app.signOut")}
            </button>
          </div>
        </div>
      </header>

      <AppNavbar
        activeView={activeView}
        onNavigate={handleNavigate}
        reportPeriodLabel={reportPeriodLabel}
        hasReport={Boolean(result)}
        databaseConfigured={databaseConfigured}
      />

      <main className="relative mx-auto max-w-7xl space-y-8 px-6 py-8">
        {error && (
          <div className="modern-panel border-red-200 bg-red-50/90 px-5 py-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {activeView === "reports" && (
          <>
            <TimelinePicker
              timelines={timelines}
              activeTimelineId={activeTimelineId}
              compareTimelineIds={compareTimelineIds}
              compareLoadingIds={compareLoadingIds}
              loading={timelinesLoading}
              loadingTimelineId={loadingTimelineId}
              deletingTimelineId={deletingTimelineId}
              databaseConfigured={databaseConfigured}
              onSelect={(id) => void handleSelectTimeline(id)}
              onDelete={(id) => handleRequestDeleteTimeline(id)}
              onToggleCompare={(id) => void handleToggleCompare(id)}
            />

            {showComparison && !result && (
              <section className="analytics-shell" id="period-totals-comparison">
                <div className="space-y-6 p-5 sm:p-8">
                  <PeriodTotalsComparison entries={comparisonEntries} />
                </div>
              </section>
            )}
          </>
        )}

        {activeView === "uploads" && (
          <div className="space-y-6">
            {uploadJustSucceeded && (
              <UploadSuccessCard
                periodLabel={uploadSuccessPeriodLabel}
                onGoToReports={handleGoToReportsFromUpload}
                onUploadAnother={handleUploadAnother}
              />
            )}
            {!uploadJustSucceeded && (
              <UploadPanel
                files={files}
                onFilesChange={setFiles}
                onCalculate={handleCalculateFromUploads}
                loading={loading}
              />
            )}
          </div>
        )}

        {activeView === "analytics" && databaseConfigured && (
          <ProductAnalytics
            timelines={timelines}
            activeTimelineId={activeTimelineId}
            databaseConfigured={databaseConfigured}
          />
        )}

        {activeView === "report" && result && (
          <>
            <Dashboard
              summary={result.summary}
              includeAllocatedAdCost={includeAllocatedAdCost}
              onHeroCascadeComplete={handleHeroCascadeComplete}
              comparisonEntries={showComparison ? comparisonEntries : undefined}
            />

            {(result.summary.rejected_order_count ?? 0) > 0 && (
              <div className="modern-panel border-violet-200 bg-violet-50/80 px-5 py-4 font-medium text-violet-900">
                {t("app.rejectedExcluded", {
                  count: result.summary.rejected_order_count ?? 0,
                  amount: new Intl.NumberFormat("he-IL", {
                    style: "currency",
                    currency: "ILS",
                  }).format(result.summary.rejected_order_total ?? 0),
                })}
              </div>
            )}

            {result.warning && (
              <div className="modern-panel border-amber-200 bg-amber-50/90 px-5 py-4 font-medium text-amber-900">
                {result.warning}
              </div>
            )}

            {(result.missing_commission_products?.length ?? 0) > 0 && (
              <MissingCommissionPanel products={result.missing_commission_products!} />
            )}

            {showLossBanner && (
              <div ref={lossBannerRef} className="scroll-mt-28">
                <LossOutcomeBanner
                  lossCount={countLossItems(result.orders, includeAllocatedAdCost)}
                />
              </div>
            )}

            <div ref={tabsBarRef} id="main-tabs" className="relative scroll-mt-28">
              <div className="modern-panel flex gap-2 p-2">
              {(
                [
                  {
                    id: "orders" as TabId,
                    label: t("app.tabOrders"),
                    count: result.orders.length,
                    active:
                      "bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-indigo-400/30",
                    idle:
                      "group border border-transparent bg-white text-ink-muted hover:border-indigo-200/80 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 hover:text-indigo-700 hover:shadow-md hover:shadow-indigo-500/20 hover:-translate-y-0.5",
                    badge: "bg-indigo-100 text-indigo-700 transition-colors duration-300 group-hover:bg-indigo-200 group-hover:text-indigo-800",
                    badgeActive: "bg-white/25 text-white",
                  },
                  {
                    id: "products" as TabId,
                    label: t("app.tabProducts"),
                    count: result.rows.length,
                    active:
                      "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/30",
                    idle:
                      "group border border-transparent bg-white text-ink-muted hover:border-emerald-200/80 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-emerald-700 hover:shadow-md hover:shadow-emerald-500/20 hover:-translate-y-0.5",
                    badge: "bg-emerald-100 text-emerald-700 transition-colors duration-300 group-hover:bg-emerald-200 group-hover:text-emerald-800",
                    badgeActive: "bg-white/25 text-white",
                  },
                  {
                    id: "losses" as TabId,
                    label: t("app.tabLosses"),
                    count: lossItemCount,
                    active:
                      "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-lg shadow-red-500/30 ring-1 ring-red-400/30",
                    idle:
                      "group border border-transparent bg-white text-ink-muted hover:border-rose-200/80 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 hover:text-red-700 hover:shadow-md hover:shadow-red-500/20 hover:-translate-y-0.5",
                    badge:
                      lossItemCount > 0
                        ? "bg-red-100 text-red-800 transition-colors duration-300 group-hover:bg-red-200 group-hover:text-red-900"
                        : "bg-slate-100 text-slate-600 transition-colors duration-300 group-hover:bg-rose-100 group-hover:text-rose-800",
                    badgeActive: "bg-white/25 text-white",
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-1 items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-base font-bold transition-all duration-300 ease-out ${
                    activeTab === tab.id ? tab.active : tab.idle
                  } ${
                    tab.id === "losses" && highlightLossesTab
                      ? "animate-tab-spotlight z-10 ring-2 ring-inset ring-red-500"
                      : ""
                  }`}
                >
                  {tab.id === "losses" && highlightLossesTab && (
                    <span
                      className="pointer-events-none absolute -top-11 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center"
                      aria-hidden
                    >
                      <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-lg shadow-red-500/40">
                        {t("app.tapHere")}
                      </span>
                      <span className="mt-0.5 text-2xl leading-none text-red-600">↓</span>
                    </span>
                  )}
                  {tab.label}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${
                      activeTab === tab.id ? tab.badgeActive : tab.badge
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
              </div>
            </div>

            {hasWoltSummary && (
              <div className="modern-panel flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <p className="text-sm font-bold text-ink">{t("app.perItemOptions")}</p>
                  <p className="mt-0.5 text-xs font-medium text-ink-faint">
                    {t("app.perItemOptionsHint")}
                  </p>
                </div>
                <label
                  className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${
                    canAllocateAds
                      ? "border-sky-200 bg-sky-50/80"
                      : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={includeAllocatedAdCost}
                    disabled={!canAllocateAds}
                    onChange={(event) => setIncludeAllocatedAdCost(event.target.checked)}
                  />
                  <span className="text-sm font-bold text-ink">
                    {t("app.includeAdCost")}
                  </span>
                </label>
              </div>
            )}

            {activeTab === "orders" && result.orders.length > 0 && (
              <OrdersTable
                orders={result.orders}
                includeAllocatedAdCost={includeAllocatedAdCost}
              />
            )}
            {activeTab === "products" && (
              <ResultsTable
                rows={result.rows}
                includeAllocatedAdCost={includeAllocatedAdCost}
              />
            )}
            {activeTab === "losses" && result.orders.length > 0 && (
              <LossItemsTable
                orders={result.orders}
                includeAllocatedAdCost={includeAllocatedAdCost}
              />
            )}
          </>
        )}

        {deletePendingTimeline && (
          <DeleteTimelineConfirmDialog
            timeline={deletePendingTimeline}
            deleting={deletingTimelineId === deletePendingTimeline.id}
            onConfirm={() => void handleConfirmDeleteTimeline()}
            onCancel={handleCancelDeleteTimeline}
          />
        )}
      </main>
    </div>
  );
}
