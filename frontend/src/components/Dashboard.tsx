/**
 * Modern KPI dashboard with count-up animations.
 */

import { CountUpCurrency } from "./CountUpCurrency";
import type { CalculationSummary } from "../types";

interface DashboardProps {
  summary: CalculationSummary;
  formula: {
    commission_base?: string;
    commission_before_vat: string;
    commission_with_vat: string;
    net_income: string;
  };
}

interface KpiCardConfig {
  id: string;
  label: string;
  value: number | undefined | null;
  accent: string;
  bar: string;
  valueClass: string;
  featured?: boolean;
  delay: number;
}

export function Dashboard({ summary, formula }: DashboardProps) {
  const soldTotal = summary.total_sold_value ?? summary.total_gross;

  const cards: KpiCardConfig[] = [
    {
      id: "sold",
      label: "Actual sold total",
      value: soldTotal,
      accent: "border-slate-200/80",
      bar: "bg-gradient-to-r from-slate-400 to-slate-600",
      valueClass: "text-ink",
      delay: 0,
    },
    {
      id: "list",
      label: "Wolt menu list value",
      value: summary.total_list_value,
      accent: "border-slate-200/80",
      bar: "bg-gradient-to-r from-slate-300 to-slate-500",
      valueClass: "text-ink-muted",
      delay: 60,
    },
    {
      id: "fee-pre",
      label: "Wolt commission (before VAT)",
      value: summary.total_commission_before_vat,
      accent: "border-amber-200/80",
      bar: "bg-gradient-to-r from-amber-400 to-orange-500",
      valueClass: "text-amber-700",
      delay: 120,
    },
    {
      id: "fee-vat",
      label: "Wolt commission (incl. VAT ×1.18)",
      value: summary.total_commission_with_vat,
      accent: "border-orange-200/80",
      bar: "bg-gradient-to-r from-orange-400 to-red-500",
      valueClass: "text-orange-700",
      delay: 180,
    },
    {
      id: "self-cost",
      label: "Product self cost (incl. VAT)",
      value: summary.total_product_self_cost ?? 0,
      accent: "border-violet-200/80",
      bar: "bg-gradient-to-r from-violet-400 to-purple-600",
      valueClass: "text-violet-700",
      delay: 240,
    },
    {
      id: "net",
      label: "Net Income Totally",
      value: summary.total_net_income,
      accent: "border-emerald-300/80",
      bar: "bg-gradient-to-r from-emerald-400 to-teal-500",
      valueClass: "text-emerald-600",
      featured: true,
      delay: 300,
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">
            Period overview
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Financial snapshot</h2>
        </div>
        <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-muted shadow-sm sm:block">
          {summary.delivered_order_count ?? 0} delivered orders
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => (
          <article
            key={card.id}
            style={{ animationDelay: `${card.delay}ms` }}
            className={`kpi-card animate-fade-up opacity-0 ${card.accent} ${
              card.featured
                ? "sm:col-span-2 lg:col-span-3 2xl:col-span-2 shadow-glow-emerald ring-1 ring-emerald-100"
                : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${card.bar}`} />
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
              {card.label}
            </p>
            <p
              className={`mt-3 font-display font-bold tabular-nums tracking-tight ${
                card.featured ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
              } ${card.valueClass}`}
            >
              <CountUpCurrency
                value={card.value}
                durationMs={card.featured ? 1400 : 1100}
              />
            </p>
            {card.featured && (
              <p className="mt-2 text-sm font-medium text-emerald-700/80">
                Your take-home after Wolt fees &amp; product costs
              </p>
            )}
          </article>
        ))}
      </div>

      <div className="modern-panel px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-ink-muted">
          <span>
            <span className="text-ink">{summary.matched_count}</span> / {summary.row_count} matched
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>
            <span className="text-ink">{summary.delivered_order_count ?? 0}</span> orders
          </span>
          {(summary.rejected_order_count ?? 0) > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-violet-700">
                {summary.rejected_order_count} rejected excluded
              </span>
            </>
          )}
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-ink-faint">
          {formula.commission_base ? `${formula.commission_base} · ` : ""}
          {formula.commission_before_vat} · {formula.commission_with_vat} · {formula.net_income}
        </p>
      </div>
    </section>
  );
}
