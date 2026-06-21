/**
 * Financial snapshot — Wolt standardSummary (primary) with orders-derived list value.
 */

import { CountUpCurrency } from "./CountUpCurrency";
import type { CalculationSummary } from "../types";

interface DashboardProps {
  summary: CalculationSummary;
  includeAllocatedAdCost?: boolean;
}

interface KpiCardConfig {
  id: string;
  label: string;
  sublabel?: string;
  value: number | undefined | null;
  accent: string;
  bar: string;
  valueClass: string;
  featured?: boolean;
  delay: number;
}

export function Dashboard({ summary, includeAllocatedAdCost = false }: DashboardProps) {
  const hasWoltSummary = summary.wolt_summary_gross_goods != null;
  const selfCost = summary.total_product_self_cost ?? 0;

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

  const ordersSold = summary.total_sold_value ?? summary.total_gross;

  const formatIls = (n: number) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(n);

  const excludedSublabel = includeAllocatedAdCost
    ? adAllocated > 0
      ? `After ad allocation (${formatIls(adAllocated)} on orders) · still not in line net income`
      : "Still not deducted from order/product net income"
    : adCampaigns > 0
      ? `Default view · ad campaigns (${formatIls(adCampaigns)}) not yet on rows`
      : "Beyond per-order distribution calc · from Wolt invoice";

  const cards: KpiCardConfig[] = hasWoltSummary
    ? [
        {
          id: "sold",
          label: "Actual sold total",
          sublabel: "Total goods sold incl. VAT · standardSummary",
          value: summary.wolt_summary_gross_goods,
          accent: "border-slate-200/80",
          bar: "bg-gradient-to-r from-slate-400 to-slate-600",
          valueClass: "text-ink",
          delay: 0,
        },
        {
          id: "list",
          label: "Wolt menu list value",
          sublabel: "From delivered orders · offers_commission.xlsx",
          value: summary.total_list_value,
          accent: "border-slate-200/80",
          bar: "bg-gradient-to-r from-slate-300 to-slate-500",
          valueClass: "text-ink-muted",
          delay: 60,
        },
        {
          id: "fee-pre",
          label: "Wolt expenses (before VAT)",
          sublabel: "WOLT INVOICE + self-billing (− adds to expenses, + reduces)",
          value: summary.wolt_summary_expenses_net,
          accent: "border-amber-200/80",
          bar: "bg-gradient-to-r from-amber-400 to-orange-500",
          valueClass: "text-amber-700",
          delay: 120,
        },
        {
          id: "fee-vat",
          label: "Wolt expenses (incl. VAT)",
          sublabel:
            selfBillingNegative > 0
              ? `WOLT INVOICE ${formatIls(woltInvoiceOnly)} + self-billing (− rows) ${formatIls(selfBillingNegative)}`
              : "WOLT INVOICE · distribution, ads, discounts…",
          value: summary.wolt_summary_expenses_incl_vat,
          accent: "border-orange-200/80",
          bar: "bg-gradient-to-r from-orange-400 to-red-500",
          valueClass: "text-orange-700",
          delay: 180,
        },
        {
          id: "additional",
          label: "Not in per-item net income",
          sublabel: excludedSublabel,
          value: excludedDisplay,
          accent: "border-rose-200/80",
          bar: "bg-gradient-to-r from-rose-400 to-pink-600",
          valueClass: "text-rose-700",
          delay: 240,
        },
        {
          id: "payout",
          label: "Payout NET (incl. VAT)",
          sublabel: "Wolt bank transfer",
          value: summary.wolt_summary_payout,
          accent: "border-sky-300/80",
          bar: "bg-gradient-to-r from-sky-400 to-blue-600",
          valueClass: "text-sky-700",
          featured: true,
          delay: 300,
        },
        {
          id: "self-cost",
          label: "Product self cost (incl. VAT)",
          sublabel: "From offers_commission.xlsx × order qty",
          value: selfCost,
          accent: "border-violet-200/80",
          bar: "bg-gradient-to-r from-violet-400 to-purple-600",
          valueClass: "text-violet-700",
          delay: 360,
        },
        {
          id: "net",
          label: "Net Income Totally",
          sublabel: "Payout NET − product self cost",
          value: woltNetIncome,
          accent: "border-emerald-300/80",
          bar: "bg-gradient-to-r from-emerald-400 to-teal-500",
          valueClass: "text-emerald-600",
          featured: true,
          delay: 420,
        },
      ]
    : [
        {
          id: "sold",
          label: "Actual sold total",
          sublabel: "Delivered orders incl. VAT",
          value: ordersSold,
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
          value: selfCost,
          accent: "border-violet-200/80",
          bar: "bg-gradient-to-r from-violet-400 to-purple-600",
          valueClass: "text-violet-700",
          delay: 240,
        },
        {
          id: "net",
          label: "Net Income Totally",
          sublabel: "Sold − commission − product self cost",
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
          {hasWoltSummary ? (
            <p className="mt-1 text-sm font-medium text-brand-700">
              From standardSummary.csv — official Wolt payout
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-ink-faint">
              Upload standardSummary.csv for Wolt invoice totals
            </p>
          )}
        </div>
        <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-muted shadow-sm sm:block">
          {summary.delivered_order_count ?? 0} delivered orders
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.id}
            style={{ animationDelay: `${card.delay}ms` }}
            className={`kpi-card animate-fade-up opacity-0 ${card.accent} ${
              card.featured ? "sm:col-span-2 shadow-glow-emerald ring-1 ring-sky-100" : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${card.bar}`} />
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-faint">
              {card.label}
            </p>
            {card.sublabel && (
              <p className="mt-0.5 text-[11px] font-medium leading-snug text-ink-faint/90">
                {card.sublabel}
              </p>
            )}
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
            {card.id === "payout" && (
              <p className="mt-2 text-sm font-medium text-sky-700/80">
                Goods sold − all Wolt expenses
              </p>
            )}
            {card.id === "net" && card.featured && (
              <p className="mt-2 text-sm font-medium text-emerald-700/80">
                {hasWoltSummary
                  ? "Payout NET − product self cost"
                  : "Sold − commission − product self cost"}
              </p>
            )}
            {card.id === "additional" && hasWoltSummary && excludedDefault != null && (
              <ul className="mt-3 space-y-1 text-[11px] font-medium leading-snug text-rose-800/90">
                {adCampaigns > 0 && (
                  <li>
                    Ad campaigns: {formatIls(adCampaigns)}
                    {includeAllocatedAdCost && adAllocated > 0
                      ? ` · ${formatIls(adAllocated)} on orders`
                      : " · not on rows (toggle to allocate)"}
                  </li>
                )}
                {otherFees > 0 && (
                  <li>Other fees (lateness, discounts, resends…): {formatIls(otherFees)}</li>
                )}
                {Math.abs(distributionGap) > 0.01 && (
                  <li>Distribution invoice vs order calc: {formatIls(distributionGap)}</li>
                )}
                {Math.abs(selfBillingNet) > 0.01 && (
                  <li>Self-billing adjustments: {formatIls(selfBillingNet)}</li>
                )}
              </ul>
            )}
          </article>
        ))}
      </div>

      <div className="modern-panel px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-ink-muted">
          <span>
            <span className="text-ink">{summary.matched_count}</span> / {summary.row_count}{" "}
            matched
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
          {hasWoltSummary && selfBillingNegative > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-amber-800">
                Self-billing (− rows) added to expenses:{" "}
                <span className="font-bold tabular-nums">{formatIls(selfBillingNegative)}</span>
              </span>
            </>
          )}
          {hasWoltSummary && includeAllocatedAdCost && adAllocated > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-sky-800">
                Ad cost on rows:{" "}
                <span className="font-bold tabular-nums">{formatIls(adAllocated)}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
