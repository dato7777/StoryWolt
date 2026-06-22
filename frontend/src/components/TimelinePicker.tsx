/**
 * Saved Wolt period timelines — clickable cards to reload a full dashboard snapshot.
 */

import type { ReportTimeline } from "../types";

interface TimelinePickerProps {
  timelines: ReportTimeline[];
  activeTimelineId: string | null;
  loading: boolean;
  loadingTimelineId: string | null;
  databaseConfigured: boolean;
  onSelect: (timelineId: string) => void;
}

function formatIls(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSavedDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function TimelinePicker({
  timelines,
  activeTimelineId,
  loading,
  loadingTimelineId,
  databaseConfigured,
  onSelect,
}: TimelinePickerProps) {
  if (!databaseConfigured) {
    return (
      <section className="modern-panel border-dashed border-slate-300 bg-slate-50/60 px-5 py-4">
        <p className="text-sm font-medium text-ink-muted">
          Saved reports — connect Supabase (<code className="text-xs">DATABASE_URL</code> in{" "}
          <code className="text-xs">.env</code>) to store timelines and commission catalog.
        </p>
      </section>
    );
  }

  if (loading && timelines.length === 0) {
    return (
      <section className="modern-panel px-5 py-6">
        <p className="text-sm font-semibold text-ink-muted">Loading saved reports…</p>
      </section>
    );
  }

  if (timelines.length === 0) {
    return (
      <section className="modern-panel border-indigo-100 bg-indigo-50/30 px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
          Saved reports
        </p>
        <p className="mt-2 text-sm font-medium text-ink-muted">
          Upload and calculate — your first period will appear here as a clickable timeline.
        </p>
      </section>
    );
  }

  return (
    <section className="modern-panel p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
            Saved reports
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
            Pick a timeline
          </h2>
          <p className="mt-1 text-sm font-medium text-ink-faint">
            {timelines.length} period{timelines.length === 1 ? "" : "s"} stored in Supabase
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {timelines.map((timeline) => {
          const isActive = activeTimelineId === timeline.id;
          const isLoading = loadingTimelineId === timeline.id;

          return (
            <button
              key={timeline.id}
              type="button"
              disabled={Boolean(loadingTimelineId)}
              onClick={() => onSelect(timeline.id)}
              className={`group relative min-w-[11rem] flex-1 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-300 sm:max-w-[16rem] sm:flex-none ${
                isActive
                  ? "border-violet-400 bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 text-white shadow-lg shadow-violet-500/30 ring-2 ring-violet-300/50"
                  : "border-slate-200/90 bg-gradient-to-br from-white via-slate-50/80 to-violet-50/40 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md hover:shadow-violet-500/10"
              } ${isLoading ? "opacity-80" : ""}`}
            >
              <div
                className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl ${
                  isActive ? "bg-white/20" : "bg-violet-400/15 group-hover:bg-violet-400/25"
                }`}
              />
              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-violet-100 text-violet-800 group-hover:bg-violet-200"
                    }`}
                  >
                    <svg
                      className="h-3 w-3 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Period
                  </span>
                  {timeline.has_wolt_summary && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive ? "bg-emerald-400/30 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      Invoice
                    </span>
                  )}
                </div>

                <p
                  className={`mt-2.5 font-mono text-base font-bold tabular-nums tracking-tight sm:text-lg ${
                    isActive ? "text-white" : "text-ink"
                  }`}
                >
                  {isLoading ? "Loading…" : timeline.period_label}
                </p>

                <p
                  className={`mt-1 text-xs font-semibold ${
                    isActive ? "text-violet-100" : "text-ink-muted"
                  }`}
                >
                  {timeline.delivered_order_count} orders · Net{" "}
                  {formatIls(timeline.headline_net_income)}
                </p>

                {timeline.created_at && (
                  <p
                    className={`mt-2 text-[10px] font-medium ${
                      isActive ? "text-violet-200/90" : "text-ink-faint"
                    }`}
                  >
                    Saved {formatSavedDate(timeline.created_at)}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
