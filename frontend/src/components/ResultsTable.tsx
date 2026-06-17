/**
 * Products tab — compact expandable rows (no horizontal scroll).
 */

import { Fragment, useMemo, useState } from "react";
import { SearchField } from "./SearchField";
import type { CalculatedRow } from "../types";

interface ResultsTableProps {
  rows: CalculatedRow[];
}

function formatIls(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value);
}

function ProductDetails({ row }: { row: CalculatedRow }) {
  const tiles = [
    { label: "SKU", value: row.merchant_sku || "—", plain: true },
    { label: "List price", value: formatIls(row.list_price), plain: false },
    { label: "Sold total (fee base)", value: formatIls(row.sold_total ?? row.gross_total), plain: false },
    { label: "Fee %", value: row.commission_percent ?? "—", plain: true },
    { label: "Fee pre-VAT", value: formatIls(row.commission_before_vat), plain: false },
    { label: "Fee totally (×1.18)", value: formatIls(row.commission_with_vat), tone: "text-orange-800" },
    { label: "Fee per item (×1.18)", value: formatIls(row.commission_with_vat_per_item ?? 0), tone: "text-orange-700" },
    { label: "Self cost (incl. VAT)", value: formatIls(row.product_self_cost ?? 0), tone: "text-violet-800" },
    { label: "Net income totally", value: formatIls(row.net_income), tone: "text-emerald-800" },
    { label: "Net income per item", value: formatIls(row.net_income_per_item ?? 0), tone: "text-emerald-700" },
  ];

  return (
    <div className="detail-grid">
      {tiles.map((tile) => (
        <div key={tile.label} className="detail-tile">
          <p className="detail-tile-label">{tile.label}</p>
          <p className={`detail-tile-value ${tile.tone ?? ""}`}>{tile.value}</p>
        </div>
      ))}
      {row.list_total != null &&
        Math.abs(row.list_total - (row.sold_total ?? row.gross_total)) > 0.01 && (
        <div className="detail-tile col-span-2 sm:col-span-3 lg:col-span-4">
          <p className="detail-tile-label">List value was</p>
          <p className="detail-tile-value text-ink-muted">{formatIls(row.list_total)}</p>
        </div>
      )}
    </div>
  );
}

export function ResultsTable({ rows }: ResultsTableProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.item_name.toLowerCase().includes(q) ||
        (row.merchant_sku || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="modern-panel overflow-hidden">
      <div className="border-b border-slate-200/80 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-lg font-bold text-ink sm:text-xl">Per-item net income</h2>
        <p className="mt-0.5 text-xs font-medium text-ink-faint sm:text-sm">
          Tap a row for full fee &amp; cost breakdown
        </p>
      </div>

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search product name or SKU…"
        resultCount={filteredRows.length}
        totalCount={rows.length}
      />

      <div className="table-scroll">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr>
              <th className="table-sticky-th w-8" />
              <th className="table-sticky-th w-[38%] sm:w-[32%]">Product</th>
              <th className="table-sticky-th w-10 text-center">Qty</th>
              <th className="table-sticky-th hidden sm:table-cell">Sold</th>
              <th className="table-sticky-th">Net total</th>
              <th className="table-sticky-th hidden md:table-cell">Net/item</th>
              <th className="table-sticky-th hidden lg:table-cell w-16">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm font-medium text-ink-muted">
                  No products match your search.
                </td>
              </tr>
            )}
            {filteredRows.map((row) => {
              const key = `${row.item_name}-${row.merchant_sku}`;
              const isOpen = expanded.has(key);
              return (
                <Fragment key={key}>
                  <tr
                    className="cursor-pointer border-t border-slate-200/70 hover:bg-emerald-50/40"
                    onClick={() => toggle(key)}
                  >
                    <td className="table-cell text-center text-ink-faint">{isOpen ? "▼" : "▶"}</td>
                    <td className="table-cell-wrap" title={row.item_name}>
                      {row.item_name}
                    </td>
                    <td className="table-cell text-center tabular-nums">{row.quantity}</td>
                    <td className="table-cell hidden tabular-nums sm:table-cell">
                      {formatIls(row.sold_total ?? row.gross_total)}
                    </td>
                    <td className="table-cell font-bold tabular-nums text-emerald-800">
                      {formatIls(row.net_income)}
                    </td>
                    <td className="table-cell hidden tabular-nums text-emerald-700 md:table-cell">
                      {formatIls(row.net_income_per_item ?? 0)}
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.status === "ok"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={7} className="border-t border-slate-200/60 p-0">
                        <ProductDetails row={row} />
                        <div className="flex items-center justify-between border-t border-slate-200/60 px-4 py-2 lg:hidden">
                          <span className="text-xs font-bold text-ink-faint">Status</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              row.status === "ok"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {row.status}
                          </span>
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
