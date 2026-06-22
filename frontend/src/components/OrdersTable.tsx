/**
 * Orders tab — compact responsive table with expandable item grid.
 */

import { Fragment, useMemo, useState } from "react";
import { useI18n } from "../i18n/LanguageContext";
import { SearchField } from "./SearchField";
import type { CalculatedOrder, OrderLineItem } from "../types";
import { lineDisplayNetIncome, orderDisplayNetIncome } from "../utils/netIncomeDisplay";

interface OrdersTableProps {
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

function orderMatchesQuery(order: CalculatedOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    order.order_number,
    order.order_placed,
    order.delivery_time,
    ...order.items.map((i) => i.item_name),
    ...order.items.map((i) => i.merchant_sku),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function ItemDetails({
  item,
  includeAllocatedAdCost,
}: {
  item: OrderLineItem;
  includeAllocatedAdCost: boolean;
}) {
  const { t } = useI18n();
  const displayNet = lineDisplayNetIncome(item, includeAllocatedAdCost);
  const displayNetPerItem = lineDisplayNetIncome(item, includeAllocatedAdCost, true);
  const quantity = item.quantity > 0 ? item.quantity : 1;
  const actualUnitPrice = Math.round((item.line_gross / quantity) * 100) / 100;
  const menuLineTotal =
    item.list_price != null ? Math.round(item.list_price * item.quantity * 100) / 100 : null;

  const tiles = [
    { label: t("fields.sku"), value: item.merchant_sku || "—" },
    {
      label: t("fields.menuPriceUnit"),
      value: formatIls(item.list_price),
      tone: item.list_price != null ? "text-ink-muted" : undefined,
    },
    {
      label: t("fields.actualPriceUnit"),
      value: formatIls(actualUnitPrice),
    },
  ];
  if (menuLineTotal != null) {
    tiles.push({
      label: t("fields.menuLineValue"),
      value: formatIls(menuLineTotal),
      tone: "text-ink-muted",
    });
  }
  tiles.push({
    label: t("fields.actualLineTotal"),
    value: formatIls(item.line_gross),
  });
  if (
    menuLineTotal != null &&
    Math.abs(menuLineTotal - item.line_gross) > 0.01
  ) {
    tiles.push({
      label: t("fields.discountVsMenu"),
      value: formatIls(item.line_gross - menuLineTotal),
      tone: item.line_gross < menuLineTotal ? "text-violet-800" : "text-ink",
    });
  }
  tiles.push(
    { label: t("fields.feePercent"), value: String(item.commission_percent ?? "—") },
    {
      label: t("fields.feeTotalInclVat"),
      value: formatIls(item.commission_with_vat),
      tone: "text-orange-800",
    },
    {
      label: t("fields.feePerItemInclVat"),
      value: formatIls(item.commission_with_vat_per_item ?? 0),
      tone: "text-orange-700",
    },
    { label: t("fields.selfCost"), value: formatIls(item.product_self_cost ?? 0), tone: "text-violet-800" },
  );
  if (includeAllocatedAdCost && (item.allocated_ad_cost ?? 0) > 0) {
    tiles.push({
      label: t("fields.allocatedAd"),
      value: formatIls(item.allocated_ad_cost),
      tone: "text-sky-800",
    });
  }
  tiles.push(
    { label: t("fields.netTotal"), value: formatIls(displayNet), tone: "text-emerald-800" },
    { label: t("fields.netPerItem"), value: formatIls(displayNetPerItem), tone: "text-emerald-700" },
  );

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4">
      <p className="mb-2 truncate text-sm font-bold text-ink sm:text-base" title={item.item_name}>
        {item.item_name}
        <span className="ml-2 font-medium text-ink-faint">×{item.quantity}</span>
      </p>
      <div className="detail-grid !p-0">
        {tiles.map((tile) => (
          <div key={tile.label} className="detail-tile">
            <p className="detail-tile-label">{tile.label}</p>
            <p className={`detail-tile-value ${tile.tone ?? ""}`}>{tile.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrdersTable({
  orders,
  includeAllocatedAdCost = false,
}: OrdersTableProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(
    () => orders.filter((order) => orderMatchesQuery(order, search)),
    [orders, search],
  );

  function toggle(orderNumber: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  }

  return (
    <section className="modern-panel overflow-hidden">
      <div className="border-b border-slate-200/80 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-lg font-bold text-ink sm:text-xl">{t("ordersTable.title")}</h2>
        <p className="mt-0.5 text-xs font-medium text-ink-faint sm:text-sm">
          {t("ordersTable.hint")}
          {includeAllocatedAdCost ? t("ordersTable.hintWithAds") : ""}
        </p>
      </div>

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder={t("ordersTable.search")}
        resultCount={filteredOrders.length}
        totalCount={orders.length}
      />

      <div className="table-scroll">
        <table className="w-full table-fixed text-start">
          <thead>
            <tr>
              <th className="table-sticky-th w-8" />
              <th className="table-sticky-th w-[28%] sm:w-[22%]">{t("fields.order")}</th>
              <th className="table-sticky-th hidden sm:table-cell">{t("fields.date")}</th>
              <th className="table-sticky-th hidden md:table-cell">{t("fields.soldTotalInclVat")}</th>
              <th className="table-sticky-th hidden lg:table-cell">{t("fields.feeSumInclVat")}</th>
              <th className="table-sticky-th">{t("fields.netTotalShort")}</th>
              <th className="table-sticky-th hidden xl:table-cell w-12 text-center">#</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm font-medium text-ink-muted">
                  {t("ordersTable.noResults")}
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => {
              const isOpen = expanded.has(order.order_number);
              const selfCostTotal = order.items.reduce(
                (sum, item) => sum + (item.product_self_cost ?? 0) * item.quantity,
                0,
              );
              const displayNet = orderDisplayNetIncome(order, includeAllocatedAdCost);

              return (
                <Fragment key={order.order_number}>
                  <tr
                    className="cursor-pointer border-t border-slate-200/70 hover:bg-indigo-50/40"
                    onClick={() => toggle(order.order_number)}
                  >
                    <td className="table-cell text-center text-ink-faint">{isOpen ? "▼" : "▶"}</td>
                    <td className="table-cell">
                      <span className="block truncate font-bold" title={order.order_number}>
                        {order.order_number}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium text-ink-faint sm:hidden">
                        {shortDate(order.delivery_time)}
                      </span>
                    </td>
                    <td className="table-cell hidden text-ink-muted sm:table-cell">
                      {shortDate(order.delivery_time)}
                    </td>
                    <td className="table-cell hidden tabular-nums md:table-cell">
                      {formatIls(order.order_gross)}
                    </td>
                    <td className="table-cell hidden tabular-nums text-orange-800 lg:table-cell">
                      {formatIls(order.commission_with_vat)}
                    </td>
                    <td className="table-cell font-bold tabular-nums text-emerald-800">
                      {formatIls(displayNet)}
                    </td>
                    <td className="table-cell hidden text-center tabular-nums text-ink-muted xl:table-cell">
                      {order.items.length}
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={7} className="border-t border-slate-200/60 px-3 py-3 sm:px-4 sm:py-4">
                        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            { label: t("fields.actualSoldTotal"), value: formatIls(order.order_gross) },
                            {
                              label: t("fields.feeTotalInclVat"),
                              value: formatIls(order.commission_with_vat),
                              tone: "text-orange-800",
                            },
                            {
                              label: t("fields.selfCostTotal"),
                              value: formatIls(selfCostTotal),
                              tone: "text-violet-800",
                            },
                            ...(includeAllocatedAdCost && (order.allocated_ad_cost ?? 0) > 0
                              ? [{
                                  label: t("fields.allocatedAd"),
                                  value: formatIls(order.allocated_ad_cost),
                                  tone: "text-sky-800",
                                }]
                              : []),
                            {
                              label: t("fields.netTotal"),
                              value: formatIls(displayNet),
                              tone: "text-emerald-800",
                            },
                          ].map((s) => (
                            <div key={s.label} className="detail-tile">
                              <p className="detail-tile-label">{s.label}</p>
                              <p className={`detail-tile-value ${s.tone ?? ""}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <ItemDetails
                              key={`${order.order_number}-${item.item_name}`}
                              item={item}
                              includeAllocatedAdCost={includeAllocatedAdCost}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
