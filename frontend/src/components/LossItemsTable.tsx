/**
 * Order lines with zero or negative net income — losses and break-even items.
 */

import { useMemo, useState } from "react";
import { useI18n } from "../i18n/LanguageContext";
import { SearchField } from "./SearchField";
import { collectLossItems, type LossLineItem } from "../utils/collectLossItems";
import type { CalculatedOrder } from "../types";

interface LossItemsTableProps {
  orders: CalculatedOrder[];
  includeAllocatedAdCost?: boolean;
}

function formatIls(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value);
}

function shortDate(value: string): string {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return value || "—";
  return `${match[1]}/${match[2]}`;
}

function matchesQuery(item: LossLineItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    item.order_number,
    item.item_name,
    item.merchant_sku,
    item.delivery_time,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function LossItemsTable({
  orders,
  includeAllocatedAdCost = false,
}: LossItemsTableProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const lossItems = useMemo(
    () => collectLossItems(orders, includeAllocatedAdCost),
    [orders, includeAllocatedAdCost],
  );

  const filtered = useMemo(
    () => lossItems.filter((item) => matchesQuery(item, search)),
    [lossItems, search],
  );

  const lossCount = lossItems.filter((item) => item.outcome === "loss").length;
  const breakEvenCount = lossItems.filter((item) => item.outcome === "break_even").length;
  const totalLoss = lossItems
    .filter((item) => item.outcome === "loss")
    .reduce((sum, item) => sum + item.net_income, 0);

  if (lossItems.length === 0) {
    return (
      <section className="modern-panel overflow-hidden border-emerald-200 bg-emerald-50/50 px-5 py-10 text-center">
        <h2 className="text-lg font-bold text-emerald-900 sm:text-xl">{t("lossesTable.emptyTitle")}</h2>
        <p className="mt-2 text-sm font-medium text-emerald-800/80">
          {t("lossesTable.emptyHint")}
          {includeAllocatedAdCost ? t("lossesTable.emptyHintAds") : ""}.
        </p>
      </section>
    );
  }

  return (
    <section className="modern-panel overflow-hidden border-red-200/80 bg-red-50/20">
      <div className="border-b border-red-200/80 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-bold text-red-950 sm:text-xl">
          {t("lossesTable.title", { count: lossItems.length })}
        </h2>
        <p className="mt-1 text-sm font-medium text-red-900/80">
          {t("lossesTable.hint")}
          {includeAllocatedAdCost ? t("lossesTable.hintWithAds") : ""}
          {" · "}
          <span className="font-bold text-red-800">{t("lossesTable.lossCount", { count: lossCount })}</span>
          {breakEvenCount > 0 && (
            <>
              ,{" "}
              <span className="font-bold text-amber-800">
                {t("lossesTable.breakEvenCount", { count: breakEvenCount })}
              </span>
            </>
          )}
          {lossCount > 0 && (
            <>
              {" "}
              {t("lossesTable.totalLoss", { amount: formatIls(totalLoss) })}
            </>
          )}
        </p>
      </div>

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder={t("lossesTable.search")}
        resultCount={filtered.length}
        totalCount={lossItems.length}
      />

      <div className="table-scroll max-h-[min(32rem,60vh)]">
        <table className="w-full table-fixed text-start">
          <thead>
            <tr>
              <th className="table-sticky-th w-[14%]">{t("fields.order")}</th>
              <th className="table-sticky-th hidden w-[10%] sm:table-cell">{t("fields.date")}</th>
              <th className="table-sticky-th w-[26%]">{t("fields.product")}</th>
              <th className="table-sticky-th hidden w-[12%] md:table-cell">{t("fields.menuUnit")}</th>
              <th className="table-sticky-th hidden w-[12%] lg:table-cell">{t("fields.soldUnit")}</th>
              <th className="table-sticky-th hidden w-[12%] md:table-cell">{t("fields.soldTotalInclVat")}</th>
              <th className="table-sticky-th w-[14%]">{t("fields.netTotalShort")}</th>
              <th className="table-sticky-th w-[12%]">{t("fields.status")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm font-medium text-ink-muted">
                  {t("lossesTable.noResults")}
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <tr
                key={`${item.order_number}-${item.item_name}-${item.actual_line_total}`}
                className="border-t border-red-200/50 hover:bg-red-50/60"
              >
                <td className="table-cell font-bold text-ink">{item.order_number}</td>
                <td className="table-cell hidden text-ink-muted sm:table-cell">
                  {shortDate(item.delivery_time)}
                </td>
                <td className="table-cell-wrap" title={item.item_name}>
                  {item.item_name}
                  <span className="ms-1 text-xs font-medium text-ink-faint">×{item.quantity}</span>
                </td>
                <td className="table-cell hidden tabular-nums text-ink-muted md:table-cell">
                  {formatIls(item.menu_price_per_unit)}
                </td>
                <td className="table-cell hidden tabular-nums lg:table-cell">
                  {formatIls(item.actual_price_per_unit)}
                </td>
                <td className="table-cell hidden tabular-nums md:table-cell">
                  {formatIls(item.actual_line_total)}
                </td>
                <td
                  className={`table-cell font-bold tabular-nums ${
                    item.outcome === "loss" ? "text-red-700" : "text-amber-800"
                  }`}
                >
                  {formatIls(item.net_income)}
                </td>
                <td className="table-cell">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.outcome === "loss"
                        ? "bg-red-100 text-red-900"
                        : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {item.outcome === "loss"
                      ? t("lossesTable.statusLoss")
                      : t("lossesTable.statusBreakEven")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Count for tab badge — lines with net income ≤ 0. */
export function countLossItems(
  orders: CalculatedOrder[],
  includeAllocatedAdCost: boolean,
): number {
  return collectLossItems(orders, includeAllocatedAdCost).length;
}
