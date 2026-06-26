import { useCallback, useEffect, useMemo, useState } from "react";
import {
  updateProductMinStock,
  type NewOrderDashboardData,
} from "../../api/client";

/** Generic low-stock hint when no user threshold is set (display filter only). */
const GENERIC_LOW_STOCK = 5;

export type StockSubTab = "full" | "attention" | "low" | "out";

type StockProduct = NewOrderDashboardData["products"][number];

const STOCK_TABS: { id: StockSubTab; label: string }[] = [
  { id: "full", label: "Full Stock" },
  { id: "attention", label: "Attention Needed" },
  { id: "low", label: "Low on Stock" },
  { id: "out", label: "Out of Stock" },
];

function isStockTracked(p: StockProduct): boolean {
  return p.is_stock !== false;
}

function needsAttention(p: StockProduct): boolean {
  return Boolean(
    p.has_min_threshold
    && p.min_stock != null
    && p.min_stock > 0
    && p.stock <= p.min_stock,
  );
}

function isOutOfStock(p: StockProduct): boolean {
  return isStockTracked(p) && p.stock <= 0;
}

function isLowOnStock(p: StockProduct): boolean {
  return (
    isStockTracked(p)
    && p.stock > 0
    && !needsAttention(p)
    && p.stock <= GENERIC_LOW_STOCK
  );
}

function stockStatusTag(p: StockProduct) {
  const tag = (() => {
    if (isOutOfStock(p)) {
      return <span className="no-tag no-tag--danger">Out</span>;
    }
    if (needsAttention(p)) {
      return <span className="no-tag no-tag--attention">Attention</span>;
    }
    if (isLowOnStock(p)) {
      return <span className="no-tag no-tag--pending">Low</span>;
    }
    return <span className="no-tag no-tag--ok">OK</span>;
  })();
  return <span className="no-stock-status">{tag}</span>;
}

type MinStockUpdate = {
  has_min_threshold: boolean;
  min_stock: number | null;
};

function MinStockEditor({
  product,
  onSaved,
}: {
  product: StockProduct;
  onSaved: (update: MinStockUpdate) => void;
}) {
  const [value, setValue] = useState(
    product.min_stock != null ? String(product.min_stock) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(product.min_stock != null ? String(product.min_stock) : "");
  }, [product.id, product.min_stock]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Invalid");
      setSaving(false);
      return;
    }
    try {
      const result = await updateProductMinStock(product.id, parsed);
      onSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [onSaved, product.id, value]);

  return (
    <div className="no-min-stock-editor">
      <input
        type="number"
        min={0}
        step={1}
        className="no-min-stock-input"
        value={value}
        placeholder="—"
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void save();
          }
        }}
        aria-label={`Minimum stock for ${product.name}`}
      />
      <button
        type="button"
        className="no-min-stock-save"
        onClick={() => void save()}
        disabled={saving}
      >
        {saving ? "…" : "Set"}
      </button>
      {error && <span className="no-min-stock-error">{error}</span>}
    </div>
  );
}

export function StockView({
  data,
  onMinStockUpdated,
}: {
  data: NewOrderDashboardData;
  onMinStockUpdated: (productId: string, update: MinStockUpdate) => void;
}) {
  const stocked = useMemo(
    () => data.products.filter(isStockTracked),
    [data.products],
  );

  const counts = useMemo(
    () => ({
      full: stocked.length,
      attention: stocked.filter(needsAttention).length,
      low: stocked.filter(isLowOnStock).length,
      out: stocked.filter(isOutOfStock).length,
    }),
    [stocked],
  );

  const [subTab, setSubTab] = useState<StockSubTab>(
    counts.attention > 0 ? "attention" : "full",
  );

  const rows = useMemo(() => {
    switch (subTab) {
      case "attention":
        return stocked.filter(needsAttention);
      case "low":
        return stocked.filter(isLowOnStock);
      case "out":
        return stocked.filter(isOutOfStock);
      default:
        return stocked;
    }
  }, [stocked, subTab]);

  const tabDescription: Record<StockSubTab, string> = {
    full: "Set minimum stock per item. Alerts appear in Attention Needed when stock reaches your threshold.",
    attention: "Items you monitor that are at or below your minimum — reorder these.",
    low: `Items with ${GENERIC_LOW_STOCK} or fewer units (no custom minimum set).`,
    out: "Items with zero stock on hand.",
  };

  return (
    <article className="no-metric-card no-metric-card--full no-stock-panel">
      <div className="no-metric-head no-stock-head">
        <div>
          <span>Inventory</span>
          <p className="no-stock-subtitle">{tabDescription[subTab]}</p>
        </div>
        <span className="no-muted-sm">{rows.length.toLocaleString()} items</span>
      </div>

      <nav className="no-stock-tabs" aria-label="Stock views">
        {STOCK_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={subTab === tab.id ? "active" : ""}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
            <span className="no-stock-tab-count">{counts[tab.id]}</span>
          </button>
        ))}
      </nav>

      <div className="no-table-scroll">
        <table className="no-table no-stock-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Stock</th>
              {subTab === "full" ? (
                <th>Min stock</th>
              ) : (
                <th>Your min</th>
              )}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-stock-empty">
                  {subTab === "attention"
                    ? "No items need attention. Set minimums in Full Stock to track items you reorder."
                    : "No products in this view."}
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className={needsAttention(p) ? "no-stock-row--attention" : ""}>
                  <td className="no-stock-name">{p.name}</td>
                  <td className="no-mono">{p.sku}</td>
                  <td>{p.category}</td>
                  <td className={p.stock <= 0 ? "no-warn" : ""}>{p.stock}</td>
                  <td>
                    {subTab === "full" ? (
                      <MinStockEditor
                        product={p}
                        onSaved={(update) => onMinStockUpdated(p.id, update)}
                      />
                    ) : p.has_min_threshold && p.min_stock != null ? (
                      <span className="no-min-display">{p.min_stock}</span>
                    ) : (
                      <span className="no-muted-sm">—</span>
                    )}
                  </td>
                  <td>{stockStatusTag(p)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
