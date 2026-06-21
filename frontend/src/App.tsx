import { useEffect, useState } from "react";
import { logoutAdmin, verifySession } from "./api/auth";
import { calculateNetIncome } from "./api/client";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";
import { MissingCommissionPanel } from "./components/MissingCommissionPanel";
import { OrdersTable } from "./components/OrdersTable";
import { ResultsTable } from "./components/ResultsTable";
import { UploadPanel } from "./components/UploadPanel";
import { getAuthUsername, hasAuthSession } from "./auth/session";
import type { CalculationResponse, UploadFiles } from "./types";

type TabId = "orders" | "products";
type AuthState = "checking" | "guest" | "authenticated";

export default function App() {
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
      } = {
        orderNumbersCsvText: await files.orderNumbers.text(),
      };
      if (files.paymentDetails) {
        payload.paymentDetailsCsvText = await files.paymentDetails.text();
      }

      const response = await calculateNetIncome(payload);
      setResult(response);
      setActiveTab(response.orders.length > 0 ? "orders" : "products");
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
        <p className="text-base font-bold text-ink-muted">Checking session…</p>
      </div>
    );
  }

  if (authState === "guest") {
    return <LoginPage onSuccess={() => setAuthState("authenticated")} />;
  }

  const adminName = getAuthUsername() ?? "admin";

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
              Wolt Net Income Dashboard
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {result && (
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 sm:flex sm:px-4 sm:py-2">
                <span className="h-2 w-2 animate-shimmer rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-emerald-800">Live results</span>
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
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl space-y-8 px-6 py-8">
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
            <Dashboard summary={result.summary} />

            {(result.summary.rejected_order_count ?? 0) > 0 && (
              <div className="modern-panel border-violet-200 bg-violet-50/80 px-5 py-4 font-medium text-violet-900">
                Excluded <strong>{result.summary.rejected_order_count}</strong> rejected order(s)
                totaling{" "}
                <strong>
                  {new Intl.NumberFormat("he-IL", {
                    style: "currency",
                    currency: "ILS",
                  }).format(result.summary.rejected_order_total ?? 0)}
                </strong>{" "}
                — not included in commission or net income (matches Wolt invoice).
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

            <div className="modern-panel flex gap-2 p-2">
              {(
                [
                  {
                    id: "orders" as TabId,
                    label: "Orders",
                    count: result.orders.length,
                    active: "bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/25",
                    idle: "text-ink-muted hover:bg-slate-50 hover:text-indigo-700",
                    badge: "bg-indigo-100 text-indigo-700",
                    badgeActive: "bg-white/20 text-white",
                  },
                  {
                    id: "products" as TabId,
                    label: "Products",
                    count: result.rows.length,
                    active: "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25",
                    idle: "text-ink-muted hover:bg-slate-50 hover:text-emerald-700",
                    badge: "bg-emerald-100 text-emerald-700",
                    badgeActive: "bg-white/20 text-white",
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-base font-bold transition-all duration-300 ${
                    activeTab === tab.id ? tab.active : tab.idle
                  }`}
                >
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

            {activeTab === "orders" && result.orders.length > 0 && (
              <OrdersTable orders={result.orders} />
            )}
            {activeTab === "products" && <ResultsTable rows={result.rows} />}
          </>
        )}
      </main>
    </div>
  );
}
