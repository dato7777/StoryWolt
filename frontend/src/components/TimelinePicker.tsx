/**
 * Saved Wolt period timelines — clickable cards to reload a full dashboard snapshot.
 */

import { useI18n } from "../i18n/LanguageContext";
import type { ReportTimeline } from "../types";

interface TimelinePickerProps {
  timelines: ReportTimeline[];
  activeTimelineId: string | null;
  compareTimelineIds: string[];
  compareLoadingIds: Set<string>;
  loading: boolean;
  loadingTimelineId: string | null;
  deletingTimelineId: string | null;
  databaseConfigured: boolean;
  onSelect: (timelineId: string) => void;
  onDelete: (timelineId: string) => void;
  onToggleCompare: (timelineId: string) => void;
}

const STAGGER_MS = 380;
const ENTER_DURATION_MS = 1800;
const SHIMMER_DURATION_MS = 2600;

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
  compareTimelineIds,
  compareLoadingIds,
  loading,
  loadingTimelineId,
  deletingTimelineId,
  databaseConfigured,
  onSelect,
  onDelete,
  onToggleCompare,
}: TimelinePickerProps) {
  const { t } = useI18n();

  if (!databaseConfigured) {
    return (
      <section className="modern-panel border-dashed border-slate-300 bg-slate-50/60 px-5 py-4">
        <p className="text-sm font-medium text-ink-muted">{t("timeline.connectDb")}</p>
      </section>
    );
  }

  if (loading && timelines.length === 0) {
    return (
      <section className="modern-panel px-5 py-6">
        <p className="text-sm font-semibold text-ink-muted">{t("timeline.loading")}</p>
      </section>
    );
  }

  if (timelines.length === 0) {
    return (
      <section className="modern-panel border-indigo-100 bg-indigo-50/30 px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
          {t("timeline.emptyTitle")}
        </p>
        <p className="mt-2 text-sm font-medium text-ink-muted">{t("timeline.emptyHint")}</p>
      </section>
    );
  }

  const busy = Boolean(loadingTimelineId || deletingTimelineId);

  return (
    <section className="timeline-picker-panel relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-indigo-950/95 p-5 shadow-[0_0_60px_rgba(34,211,238,0.08),0_24px_48px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-6">
      <style>{`
        @keyframes timeline-card-arrive {
          0% {
            opacity: 0;
            transform: translateX(-56px) scale(0.86) rotateY(8deg);
            filter: blur(10px) brightness(1.4);
          }
          55% {
            opacity: 1;
            transform: translateX(8px) scale(1.03) rotateY(0deg);
            filter: blur(0) brightness(1.08);
          }
          78% {
            transform: translateX(-3px) scale(0.99) rotateY(0deg);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1) rotateY(0deg);
            filter: blur(0) brightness(1);
          }
        }

        @keyframes timeline-shimmer-sweep {
          0% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
          30% { opacity: 0.7; }
          100% { transform: translateX(220%) skewX(-12deg); opacity: 0; }
        }

        @keyframes timeline-edge-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }

        .timeline-card-enter {
          animation: timeline-card-arrive ${ENTER_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) both;
          transform-origin: left center;
          perspective: 800px;
        }

        .timeline-card-enter .timeline-shimmer {
          animation: timeline-shimmer-sweep ${SHIMMER_DURATION_MS}ms ease-out both;
        }

        .timeline-card-idle {
          border-color: rgba(34, 211, 238, 0.22);
          background: linear-gradient(
            145deg,
            rgba(15, 23, 42, 0.92) 0%,
            rgba(30, 27, 75, 0.78) 48%,
            rgba(15, 23, 42, 0.88) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 0 0 1px rgba(34, 211, 238, 0.08),
            0 8px 32px rgba(0, 0, 0, 0.35);
        }

        .timeline-card-idle:hover:not(:disabled) {
          border-color: rgba(56, 189, 248, 0.55);
          background: linear-gradient(
            145deg,
            rgba(30, 41, 59, 0.95) 0%,
            rgba(49, 46, 129, 0.85) 45%,
            rgba(15, 23, 42, 0.92) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 0 0 1px rgba(56, 189, 248, 0.35),
            0 0 28px rgba(34, 211, 238, 0.22),
            0 12px 40px rgba(79, 70, 229, 0.25);
          transform: translateY(-3px) scale(1.02);
        }

        .timeline-card-active {
          border-color: rgba(167, 139, 250, 0.65);
          background: linear-gradient(
            135deg,
            #4c1d95 0%,
            #2563eb 38%,
            #0891b2 72%,
            #7c3aed 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 0 0 1px rgba(196, 181, 253, 0.4),
            0 0 40px rgba(34, 211, 238, 0.35),
            0 16px 48px rgba(79, 70, 229, 0.45);
        }

        .timeline-card-active:hover:not(:disabled) {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.25),
            0 0 0 1px rgba(224, 231, 255, 0.5),
            0 0 52px rgba(34, 211, 238, 0.45),
            0 20px 56px rgba(99, 102, 241, 0.5);
          transform: translateY(-2px) scale(1.01);
        }

        .timeline-card-compare-selected {
          box-shadow:
            inset 0 0 0 2px rgba(34, 211, 238, 0.75),
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 0 0 1px rgba(34, 211, 238, 0.08),
            0 8px 32px rgba(0, 0, 0, 0.35);
        }

        .timeline-card-active.timeline-card-compare-selected {
          box-shadow:
            inset 0 0 0 2px rgba(186, 230, 253, 0.95),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 0 0 1px rgba(196, 181, 253, 0.4),
            0 0 40px rgba(34, 211, 238, 0.35),
            0 16px 48px rgba(79, 70, 229, 0.45);
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
        style={{ animation: "timeline-edge-pulse 3s ease-in-out infinite" }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center gap-1 text-center sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-400/90">
            {t("timeline.savedReports")}
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
            {t("timeline.pickTimeline")}
          </h2>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2.5 sm:mt-5 sm:gap-3">
        {timelines.map((timeline, index) => {
          const isActive = activeTimelineId === timeline.id;
          const isLoading = loadingTimelineId === timeline.id;
          const isDeleting = deletingTimelineId === timeline.id;
          const isComparing = compareTimelineIds.includes(timeline.id);
          const isCompareLoading = compareLoadingIds.has(timeline.id);

          return (
            <div
              key={timeline.id}
              className={`timeline-card-enter group/card relative min-w-[11rem] max-w-[16rem] flex-none ${
                isDeleting ? "opacity-50" : ""
              }`}
              style={{ animationDelay: `${index * STAGGER_MS}ms` }}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(timeline.id)}
                className={`relative w-full overflow-hidden rounded-2xl border px-4 py-4 pb-11 pr-10 text-left transition-all duration-500 ease-out ${
                  isActive ? "timeline-card-active text-white" : "timeline-card-idle text-slate-100"
                } ${isComparing ? "timeline-card-compare-selected" : ""} ${isLoading ? "opacity-80" : ""}`}
              >
                <div
                  className="timeline-shimmer pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  style={{ animationDelay: `${index * STAGGER_MS + 420}ms` }}
                  aria-hidden
                />
                <div
                  className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl transition-opacity duration-500 ${
                    isActive
                      ? "bg-cyan-300/30 opacity-100"
                      : "bg-cyan-400/10 opacity-60 group-hover/card:bg-cyan-400/25 group-hover/card:opacity-100"
                  }`}
                />
                <div
                  className={`pointer-events-none absolute -bottom-4 -left-4 h-14 w-14 rounded-full blur-2xl transition-opacity duration-500 ${
                    isActive
                      ? "bg-violet-400/25 opacity-100"
                      : "bg-violet-500/0 opacity-0 group-hover/card:bg-violet-500/20 group-hover/card:opacity-100"
                  }`}
                />

                <div className="relative z-[2]">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ${
                        isActive
                          ? "border-white/25 bg-white/15 text-white"
                          : "border-cyan-500/25 bg-cyan-500/10 text-cyan-300 group-hover/card:border-cyan-400/40 group-hover/card:bg-cyan-400/15 group-hover/card:text-cyan-200"
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
                    {t("common.period")}
                    </span>
                    {timeline.has_wolt_summary && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors duration-300 ${
                          isActive
                            ? "border-emerald-300/30 bg-emerald-400/20 text-emerald-100"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 group-hover/card:border-emerald-400/45 group-hover/card:text-emerald-200"
                        }`}
                      >
                        {t("common.invoice")}
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-2.5 font-mono text-base font-bold tabular-nums tracking-tight sm:text-lg ${
                      isActive ? "text-white" : "text-slate-50 group-hover/card:text-white"
                    }`}
                  >
                    {isLoading ? t("timeline.loadingPeriod") : timeline.period_label}
                  </p>

                  <p
                    className={`mt-1 text-xs font-semibold transition-colors duration-300 ${
                      isActive ? "text-cyan-100/90" : "text-slate-400 group-hover/card:text-slate-300"
                    }`}
                  >
                    {timeline.delivered_order_count} {t("common.orders")} · {t("common.net")}{" "}
                    {formatIls(timeline.headline_net_income)}
                  </p>

                  {timeline.created_at && (
                    <p
                      className={`mt-2 text-[10px] font-medium transition-colors duration-300 ${
                        isActive ? "text-violet-200/80" : "text-slate-500 group-hover/card:text-slate-400"
                      }`}
                    >
                      {t("common.saved")} {formatSavedDate(timeline.created_at)}
                    </p>
                  )}
                </div>
              </button>

              <button
                type="button"
                title={isComparing ? t("timeline.compareRemoveTitle") : t("timeline.compareTitle")}
                disabled={busy || isCompareLoading}
                aria-label={t("timeline.compareAria", { label: timeline.period_label })}
                aria-pressed={isComparing}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCompare(timeline.id);
                }}
                className={`absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-300 ${
                  isComparing
                    ? "border-cyan-400/60 bg-cyan-500/30 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.4)]"
                    : isActive
                      ? "border-white/20 bg-white/10 text-white hover:border-cyan-400/60 hover:bg-cyan-500/40 hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                      : "border-slate-600/50 bg-slate-900/60 text-slate-500 hover:border-cyan-400/50 hover:bg-cyan-950/80 hover:text-cyan-300 hover:shadow-[0_0_14px_rgba(34,211,238,0.3)]"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {isCompareLoading ? (
                  <span className="text-[10px] font-bold">…</span>
                ) : (
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <rect x="3" y="3" width="8" height="8" rx="1" />
                    <rect x="13" y="13" width="8" height="8" rx="1" />
                    <path d="M11 7h6M7 11v6" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                title={t("timeline.deleteTitle")}
                disabled={busy}
                aria-label={t("timeline.deleteAria", { label: timeline.period_label })}
                onClick={() => onDelete(timeline.id)}
                className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-300 ${
                  isActive
                    ? "border-white/20 bg-white/10 text-white hover:border-red-400/60 hover:bg-red-500/80 hover:shadow-[0_0_16px_rgba(248,113,113,0.45)]"
                    : "border-slate-600/50 bg-slate-900/60 text-slate-500 hover:border-red-400/50 hover:bg-red-950/80 hover:text-red-300 hover:shadow-[0_0_14px_rgba(248,113,113,0.3)]"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {isDeleting ? (
                  <span className="text-[10px] font-bold">…</span>
                ) : (
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 min-h-5 text-center">
        {compareTimelineIds.length === 1 && (
          <p className="text-xs font-medium text-cyan-200/70">
            {t("compare.selectMore")}
          </p>
        )}
        {compareTimelineIds.length >= 2 && (
          <p className="text-xs font-semibold text-cyan-300/90">
            {t("compare.subtitle", { count: compareTimelineIds.length })}
          </p>
        )}
      </div>
    </section>
  );
}
