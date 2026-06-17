/**
 * Orders tab — compact responsive table with expandable item grid.
 */

import { Fragment, useMemo, useState } from "react";
import { SearchField } from "./SearchField";
import type { CalculatedOrder, OrderLineItem } from "../types";

interface OrdersTableProps {
  orders: CalculatedOrder[];
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

function ItemDetails({ item }: { item: OrderLineItem }) {
  const tiles = [
    { label: "SKU", value: item.merchant_sku || "—" },
    { label: "Line gross", value: formatIls(item.line_gross) },
    { label: "Fee %", value: item.commission_percent ?? "—" },
    { label: "Fee totally (×1.18)", value: formatIls(item.commission_with_vat), tone: "text-orange-800" },
    { label: "Fee per item (×1.18)", value: formatIls(item.commission_with_vat_per_item ?? 0), tone: "text-orange-700" },
    { label: "Self cost (incl. VAT)", value: formatIls(item.product_self_cost ?? 0), tone: "text-violet-800" },
    { label: "Net income totally", value: formatIls(item.net_income), tone: "text-emerald-800" },
    { label: "Net income per item", value: formatIls(item.net_income_per_item ?? 0), tone: "text-emerald-700" },
  ];

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

export function OrdersTable({ orders }: OrdersTableProps) {
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
        <h2 className="text-lg font-bold text-ink sm:text-xl">Net income per order</h2>
        <p className="mt-0.5 text-xs font-medium text-ink-faint sm:text-sm">
          Oldest first · tap a row to expand item breakdown
        </p>
      </div>

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search order #, date, or product name…"
        resultCount={filteredOrders.length}
        totalCount={orders.length}
      />

      <div className="table-scroll">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr>
              <th className="table-sticky-th w-8" />
              <th className="table-sticky-th w-[28%] sm:w-[22%]">Order</th>
              <th className="table-sticky-th hidden sm:table-cell">Date</th>
              <th className="table-sticky-th hidden md:table-cell">Gross</th>
              <th className="table-sticky-th hidden lg:table-cell">Fee Σ</th>
              <th className="table-sticky-th">Net total</th>
              <th className="table-sticky-th hidden xl:table-cell w-12 text-center">#</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm font-medium text-ink-muted">
                  No orders match your search.
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => {
              const isOpen = expanded.has(order.order_number);
              const selfCostTotal = order.items.reduce(
                (sum, item) => sum + (item.product_self_cost ?? 0) * item.quantity,
                0,
              );

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
                      {formatIls(order.net_income)}
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
                            { label: "Gross", value: formatIls(order.order_gross) },
                            { label: "Fee totally (×1.18)", value: formatIls(order.commission_with_vat), tone: "text-orange-800" },
                            { label: "Self cost total", value: formatIls(selfCostTotal), tone: "text-violet-800" },
                            { label: "Net income totally", value: formatIls(order.net_income), tone: "text-emerald-800" },
                          ].map((s) => (
                            <div key={s.label} className="detail-tile">
                              <p className="detail-tile-label">{s.label}</p>
                              <p className={`detail-tile-value ${s.tone ?? ""}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <ItemDetails key={`${order.order_number}-${item.item_name}`} item={item} />
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
