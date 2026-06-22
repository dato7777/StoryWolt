import { useCallback, useEffect, useRef, useState } from "react";
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
import { WelcomeSplash } from "./components/WelcomeSplash";
import { getAuthUsername, hasAuthSession } from "./auth/session";
import { useI18n } from "./i18n/LanguageContext";
import type { CalculationResponse, ReportTimeline, UploadFiles } from "./types";

type TabId = "orders" | "products" | "losses";
type AuthState = "checking" | "guest" | "welcoming" | "authenticated";

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
      }
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
    setLoadingTimelineId(timelineId);
    setError(null);
    try {
      const response = await fetchReportTimeline(timelineId);
      applyDashboardResult(response, timelineId);
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

  async function handleCalculate() {
    if (!files.orderNumbers) return;

    setLoading(true);
    setError(null);

    try {
      const payload: {
        orderNumbersCsvText: string;
        paymentDetailsCsvText?: string;
        orderNumbersFileName?: string;
        paymentDetailsFileName?: string;
      } = {
        orderNumbersCsvText: await files.orderNumbers.text(),
        orderNumbersFileName: files.orderNumbers.name,
      };
      if (files.paymentDetails) {
        payload.paymentDetailsCsvText = await files.paymentDetails.text();
        payload.paymentDetailsFileName = files.paymentDetails.name;
      }

      const response = await calculateNetIncome(payload);
      applyDashboardResult(response, response.timeline_id ?? null);
      void refreshTimelines();
      // Persist runs after API response; re-fetch so saved-report buttons appear.
      window.setTimeout(() => void refreshTimelines(), 2500);
    } catch (err) {
      setResult(null);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      if (message.includes("sign in again")) {
        setAuthState("guest");
      }
    } finally {
      setLoading(false);
    }
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
      <div className="orb -left-32 top-0 h-96 w-96 animate-orb-float bg-indigo-500/25" />
      <div
        className="orb right-0 top-1/4 h-[28rem] w-[28rem] animate-orb-float bg-sky-400/20"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="orb bottom-0 left-1/3 h-80 w-80 animate-orb-float bg-violet-500/18"
        style={{ animationDelay: "-12s" }}
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
            {result && (
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

      <main className="relative mx-auto max-w-7xl space-y-8 px-6 py-8">
        <TimelinePicker
          timelines={timelines}
          activeTimelineId={activeTimelineId}
          loading={timelinesLoading}
          loadingTimelineId={loadingTimelineId}
          deletingTimelineId={deletingTimelineId}
          databaseConfigured={databaseConfigured}
          onSelect={(id) => void handleSelectTimeline(id)}
          onDelete={(id) => handleRequestDeleteTimeline(id)}
        />

        {deletePendingTimeline && (
          <DeleteTimelineConfirmDialog
            timeline={deletePendingTimeline}
            deleting={deletingTimelineId === deletePendingTimeline.id}
            onConfirm={() => void handleConfirmDeleteTimeline()}
            onCancel={handleCancelDeleteTimeline}
          />
        )}

        <UploadPanel
          files={files}
          onFilesChange={setFiles}
          onCalculate={handleCalculate}
          loading={loading}
        />

        {error && (
          <div className="modern-panel border-red-200 bg-red-50/90 px-5 py-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {result && (
          <>
            <Dashboard
              summary={result.summary}
              includeAllocatedAdCost={includeAllocatedAdCost}
              onHeroCascadeComplete={handleHeroCascadeComplete}
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
      </main>
    </div>
  );
}
