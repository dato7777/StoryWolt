/**
 * Collapsible invoice reconciliation — hidden until user opens "Additional Info".
 * Each phase is its own expandable accordion inside.
 */

import { useState } from "react";
import type { InvoicePhase, InvoiceReconciliation, InvoiceStep } from "../types";

interface InvoiceWaterfallProps {
  invoice: InvoiceReconciliation;
}

function formatIls(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value);
}

function stepStyles(type: string): { badge: string; icon: string } {
  switch (type) {
    case "start":
      return { badge: "bg-sky-100 text-sky-800", icon: "①" };
    case "subtract":
      return { badge: "bg-violet-100 text-violet-800", icon: "−" };
    case "milestone":
      return { badge: "bg-brand-100 text-brand-800", icon: "=" };
    case "result":
      return { badge: "bg-emerald-100 text-emerald-800", icon: "✓" };
    default:
      return { badge: "bg-slate-100 text-slate-600", icon: "·" };
  }
}

/** Renders steps inside one expandable phase */
function PhaseSteps({ steps, invoice }: { steps: InvoiceStep[]; invoice: InvoiceReconciliation }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => {
        const styles = stepStyles(step.step_type);
        return (
          <li key={step.id} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${styles.badge}`}
                  >
                    {styles.icon}
                  </span>
                  <p className="text-sm font-medium text-slate-900">{step.label}</p>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{step.label_he}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{step.note}</p>
                {step.id === "net_sold_orders" && invoice.orders_match_invoice === true && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    ✓ Matches invoice: ₪85,609 − ₪1,350 = ₪84,259
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-sm">
                {step.step_type === "subtract" ? (
                  <p className="font-semibold text-violet-700">{formatIls(step.amount)}</p>
                ) : (
                  <p className="font-bold text-slate-900">{formatIls(step.running_total)}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Single expandable phase accordion */
function PhaseAccordion({
  phase,
  invoice,
}: {
  phase: InvoicePhase;
  invoice: InvoiceReconciliation;
}) {
  const [open, setOpen] = useState(false);
  const badgeClass =
    phase.id === "1"
      ? "bg-violet-600"
      : phase.id === "2"
        ? "bg-emerald-600"
        : "bg-amber-600";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${badgeClass}`}>
              Phase {phase.id}
            </span>
            <p className="font-semibold text-slate-900">{phase.title}</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">{phase.subtitle}</p>
        </div>
        <span className="text-slate-400">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
          <PhaseSteps steps={phase.steps} invoice={invoice} />
        </div>
      )}
    </div>
  );
}

export function InvoiceWaterfall({ invoice }: InvoiceWaterfallProps) {
  const [expanded, setExpanded] = useState(false);
  const phases = invoice.phases ?? [];
  const hasPaymentDetails = invoice.source === "payment_details.csv";

  return (
    <section className="modern-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50/80"
      >
        <div>
          <h2 className="text-base font-bold text-ink">Additional Info</h2>
          <p className="mt-0.5 text-sm font-medium text-ink-faint">
            Invoice reconciliation · how ₪70,590 app net relates to ₪66,352 bank payout
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-ink-muted shadow-sm">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-6 py-5">
          <p className="text-sm text-slate-600">
            Display only — <strong>per-item net income is not changed</strong> by any of these
            invoice lines.
          </p>

          {!hasPaymentDetails && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Upload <strong>payment_details.csv</strong> for the full 3-phase breakdown including
              bank payout.
            </p>
          )}

          {phases.map((phase) => (
            <PhaseAccordion key={phase.id} phase={phase} invoice={invoice} />
          ))}
        </div>
      )}
    </section>
  );
}
