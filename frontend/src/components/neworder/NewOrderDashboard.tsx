import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChoosePlatformButton } from "../ChoosePlatformButton";
import {
  fetchNewOrderDashboard,
  fetchNewOrderStatus,
  type NewOrderDashboardData,
  type NewOrderDashboardPeriod,
  type NewOrderLastSync,
} from "../../api/client";
import {
  getNewOrderSyncUIState,
  resumeNewOrderSyncIfNeeded,
  startNewOrderSync,
  subscribeNewOrderSync,
} from "../../api/neworderSyncManager";
import { useCountUp } from "../../hooks/useCountUp";
import { formatIls, NAV_ITEMS, type NewOrderView } from "../../data/neworderMockData";
import { CountUpCurrency } from "../CountUpCurrency";
import { CountUpNumber } from "./CountUpNumber";
import { StockView } from "./StockView";

const NEWORDER_LOGO = "/logos/neworder.png";
const SYNC_HOURS = 24;
const KPI_COUNT_DURATION_MS = 900;
const KPI_COUNT_PAUSE_MS = 140;
const TACHOMETER_DURATION_MS = 1200;

const PERIOD_TABS: { id: NewOrderDashboardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Last week" },
];

const SEARCH_PLACEHOLDERS: Record<NewOrderView, string> = {
  dashboard: "Search best sellers…",
  analytics: "Search products…",
  products: "Search SKU, name, category…",
  orders: "Search document, item, employee…",
  stock: "Search product or SKU…",
  employees: "Search employee…",
};

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesSearch(value: string | null | undefined, query: string): boolean {
  if (!query) return true;
  return (value ?? "").toLowerCase().includes(query);
}

function filterDashboardBySearch(
  data: NewOrderDashboardData,
  view: NewOrderView,
  rawQuery: string,
): NewOrderDashboardData {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return data;

  switch (view) {
    case "dashboard":
      return {
        ...data,
        top_products: data.top_products.filter(
          (p) => matchesSearch(p.name, query) || matchesSearch(p.category, query),
        ),
      };
    case "analytics":
      return {
        ...data,
        top_products: data.top_products.filter((p) => matchesSearch(p.name, query)),
        best_net_revenue: data.best_net_revenue.filter((r) => matchesSearch(r.name, query)),
      };
    case "products":
      return {
        ...data,
        products: data.products.filter(
          (p) =>
            matchesSearch(p.name, query)
            || matchesSearch(p.sku, query)
            || matchesSearch(p.category, query),
        ),
      };
    case "orders":
      return {
        ...data,
        orders: data.orders.filter(
          (o) =>
            matchesSearch(o.document_number, query)
            || matchesSearch(o.product_label, query)
            || matchesSearch(o.employee, query),
        ),
      };
    case "stock":
      return {
        ...data,
        products: data.products.filter(
          (p) =>
            matchesSearch(p.name, query)
            || matchesSearch(p.sku, query)
            || matchesSearch(p.category, query),
        ),
      };
    case "employees":
      return {
        ...data,
        employees: data.employees.filter((e) => matchesSearch(e.name, query)),
      };
    default:
      return data;
  }
}

function formatLastSync(lastSync: NewOrderLastSync | null): string {
  if (!lastSync?.finished_at && !lastSync?.started_at) {
    return "Never";
  }
  const stamp = lastSync.finished_at ?? lastSync.started_at;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) {
    return stamp;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatOrderDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function syncStatusLabel(lastSync: NewOrderLastSync | null): string {
  if (!lastSync) return "No sync yet";
  if (lastSync.status === "running") return "Sync in progress…";
  if (lastSync.status === "failed") return "Last sync failed";
  if (lastSync.status === "partial") return "Last sync partial";
  return "Last sync successful";
}

interface NewOrderDashboardProps {
  adminName: string;
  onBackToHub: () => void;
}

function PeriodTimeTabs({
  active,
  onChange,
}: {
  active: NewOrderDashboardPeriod;
  onChange: (period: NewOrderDashboardPeriod) => void;
}) {
  return (
    <div className="no-time-tabs">
      {PERIOD_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DashboardSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="no-search-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search current page"
      />
      {value && (
        <button
          type="button"
          className="no-search-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </label>
  );
}

function CustomerTachometer({
  uniqueCustomers,
  volumePct,
  animateGauge,
}: {
  uniqueCustomers: number;
  volumePct: number;
  animateGauge: boolean;
}) {
  const segments = 32;
  const cx = 100;
  const cy = 98;
  const innerR = 52;
  const outerR = 78;
  const startAngle = -180;
  const endAngle = 0;

  const animatedPct = useCountUp(animateGauge ? volumePct : 0, TACHOMETER_DURATION_MS, {
    enabled: animateGauge,
  });
  const animatedCustomers = useCountUp(animateGauge ? uniqueCustomers : 0, TACHOMETER_DURATION_MS, {
    enabled: animateGauge,
  });

  const filledCount = Math.round(segments * (Math.min(100, animatedPct) / 100));

  return (
    <div className="no-tachometer">
      <svg viewBox="0 0 200 115" className="no-tachometer-svg" aria-hidden>
        {Array.from({ length: segments }).map((_, i) => {
          const t = i / (segments - 1);
          const angle = startAngle + t * (endAngle - startAngle);
          const rad = (angle * Math.PI) / 180;
          const x1 = cx + innerR * Math.cos(rad);
          const y1 = cy + innerR * Math.sin(rad);
          const x2 = cx + outerR * Math.cos(rad);
          const y2 = cy + outerR * Math.sin(rad);
          const isActive = i < filledCount;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isActive ? "#c1ff4d" : "#e8eaef"}
              strokeWidth="5.5"
              strokeLinecap="round"
              style={{ transition: "stroke 0.12s ease" }}
            />
          );
        })}
      </svg>
      <div className="no-tachometer-center">
        <strong>{Math.round(animatedCustomers).toLocaleString()}</strong>
        <span>Unique Customers</span>
      </div>
    </div>
  );
}

function SequentialCurrency({
  index,
  activeIndex,
  value,
  className,
  onComplete,
}: {
  index: number;
  activeIndex: number;
  value: number;
  className?: string;
  onComplete?: () => void;
}) {
  const isCurrent = activeIndex === index;
  const isPast = activeIndex > index;

  useEffect(() => {
    if (!isCurrent) return;
    if (value === 0) {
      const timer = window.setTimeout(() => onComplete?.(), 80);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isCurrent, onComplete, value]);

  if (isPast) {
    return <strong className={className}>{formatIls(value)}</strong>;
  }

  if (!isCurrent) {
    return <strong className={`no-metric-count ${className ?? ""}`}>{formatIls(0)}</strong>;
  }

  return (
    <strong className={`no-metric-count ${className ?? ""}`}>
      <CountUpCurrency
        value={value}
        durationMs={KPI_COUNT_DURATION_MS}
        animate
        onComplete={onComplete}
      />
    </strong>
  );
}

function SequentialNumber({
  index,
  activeIndex,
  value,
  className,
  onComplete,
}: {
  index: number;
  activeIndex: number;
  value: number;
  className?: string;
  onComplete?: () => void;
}) {
  const isCurrent = activeIndex === index;
  const isPast = activeIndex > index;

  useEffect(() => {
    if (!isCurrent) return;
    if (value === 0) {
      const timer = window.setTimeout(() => onComplete?.(), 80);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isCurrent, onComplete, value]);

  if (isPast) {
    return <strong className={className}>{value.toLocaleString()}</strong>;
  }

  if (!isCurrent) {
    return <strong className={`no-metric-count ${className ?? ""}`}>0</strong>;
  }

  return (
    <strong className={`no-metric-count ${className ?? ""}`}>
      <CountUpNumber
        value={value}
        durationMs={KPI_COUNT_DURATION_MS}
        animate
        onComplete={onComplete}
      />
    </strong>
  );
}

function DashboardOverview({ data }: { data: NewOrderDashboardData }) {
  const { kpi, daily_sales, top_products, period_label, chart_title } = data;
  const [activeMetricIndex, setActiveMetricIndex] = useState(-1);
  const [gaugeAnimating, setGaugeAnimating] = useState(false);

  const cascadeKey = useMemo(
    () =>
      [
        data.period,
        kpi.total_sales,
        kpi.net_revenue,
        kpi.total_cost,
        kpi.units_sold,
        kpi.order_count,
        kpi.unique_customer_count,
        kpi.customer_volume_pct,
      ].join("|"),
    [
      data.period,
      kpi.total_sales,
      kpi.net_revenue,
      kpi.total_cost,
      kpi.units_sold,
      kpi.order_count,
      kpi.unique_customer_count,
      kpi.customer_volume_pct,
    ],
  );

  useEffect(() => {
    setActiveMetricIndex(-1);
    setGaugeAnimating(false);
    const timer = window.setTimeout(() => setActiveMetricIndex(0), 160);
    return () => window.clearTimeout(timer);
  }, [cascadeKey]);

  const handleMetricComplete = useCallback((index: number) => {
    window.setTimeout(() => {
      setActiveMetricIndex((current) => {
        if (current !== index) return current;
        if (index < 4) return index + 1;
        return current;
      });
      if (index === 4) {
        setGaugeAnimating(true);
      }
    }, KPI_COUNT_PAUSE_MS);
  }, []);

  const lastActiveIndex = daily_sales.reduce(
    (best, point, index) => (point.revenue > (daily_sales[best]?.revenue ?? -1) ? index : best),
    0,
  );
  const marginPct = kpi.total_sales > 0
    ? Math.round((kpi.net_revenue / kpi.total_sales) * 100)
    : 0;

  return (
    <div className="no-dash-grid">
      <div className="no-dash-col no-dash-col--sales">
        <article className="no-metric-card no-metric-card--dark">
          <div className="no-metric-head">
            <span>Total Sales</span>
            <button type="button" className="no-dots" aria-label="Options">···</button>
          </div>
          <SequentialCurrency
            index={0}
            activeIndex={activeMetricIndex}
            value={kpi.total_sales}
            onComplete={() => handleMetricComplete(0)}
          />
          <span className="no-pill no-pill--up">{kpi.order_count} orders · incl. VAT</span>
        </article>
        <article className="no-metric-card no-metric-card--net">
          <div className="no-metric-head">
            <span>Net Revenue</span>
            <button type="button" className="no-dots" aria-label="Options">···</button>
          </div>
          <SequentialCurrency
            index={1}
            activeIndex={activeMetricIndex}
            value={kpi.net_revenue}
            onComplete={() => handleMetricComplete(1)}
          />
          <span className="no-pill no-pill--up">Sales − cost (incl. VAT) · {marginPct}% margin</span>
        </article>
        <article className="no-metric-card">
          <div className="no-metric-head">
            <span>Total Cost</span>
            <button type="button" className="no-dots" aria-label="Options">···</button>
          </div>
          <SequentialCurrency
            index={2}
            activeIndex={activeMetricIndex}
            value={kpi.total_cost}
            className="no-metric-dark"
            onComplete={() => handleMetricComplete(2)}
          />
          <span className="no-pill no-pill--down">{period_label}</span>
        </article>
      </div>

      <div className="no-dash-col no-dash-col--units">
        <article className="no-metric-card no-metric-card--compact">
          <div className="no-metric-head">
            <span>Units Sold</span>
          </div>
          <SequentialNumber
            index={3}
            activeIndex={activeMetricIndex}
            value={kpi.units_sold}
            className="no-metric-dark"
            onComplete={() => handleMetricComplete(3)}
          />
          <span className="no-pill no-pill--up no-pill--sm">{period_label}</span>
          <div className="no-progress-track no-progress-track--compact">
            <div
              className="no-progress-fill"
              style={{
                width: kpi.total_sales > 0
                  ? `${Math.min(100, Math.round((kpi.net_revenue / kpi.total_sales) * 100))}%`
                  : "0%",
              }}
            />
          </div>
          <div className="no-progress-foot no-progress-foot--compact">
            <span>Net {formatIls(kpi.net_revenue)}</span>
          </div>
        </article>
        <article className="no-metric-card no-metric-card--compact no-metric-card--purchases">
          <div className="no-metric-head">
            <span>Purchases</span>
          </div>
          <SequentialNumber
            index={4}
            activeIndex={activeMetricIndex}
            value={kpi.order_count}
            className="no-metric-dark"
            onComplete={() => handleMetricComplete(4)}
          />
          <span className="no-pill no-pill--up no-pill--sm">sales in {period_label.toLowerCase()}</span>
          <div className="no-progress-track no-progress-track--compact">
            <div
              className="no-progress-fill"
              style={{
                width: kpi.order_count > 0
                  ? `${Math.min(100, kpi.customer_volume_pct)}%`
                  : "0%",
              }}
            />
          </div>
          <div className="no-progress-foot no-progress-foot--compact">
            <span>{kpi.unique_customer_count} unique customers</span>
          </div>
        </article>
      </div>

      <article className="no-metric-card no-metric-card--gauge">
        <div className="no-metric-head"><span>Customers Volume</span></div>
        <CustomerTachometer
          uniqueCustomers={kpi.unique_customer_count}
          volumePct={kpi.customer_volume_pct}
          animateGauge={gaugeAnimating}
        />
        <p className="no-gauge-note">
          {kpi.unique_customer_count} unique customers
          {kpi.order_count > 0 && (
            <span className="no-pill no-pill--up no-pill--sm">{kpi.customer_volume_pct}% of orders</span>
          )}
        </p>
      </article>

      <article className="no-metric-card no-metric-card--chart">
        <div className="no-metric-head">
          <span>{chart_title ?? "Revenue"}</span>
          <span className="no-muted-sm">{period_label}</span>
        </div>
        <p className="no-chart-lead">
          <strong>{formatIls(kpi.total_sales)}</strong>
          total · {kpi.order_count} purchases
        </p>
        <div className={`no-week-bars ${daily_sales.length > 12 ? "no-week-bars--dense" : ""}`}>
          {daily_sales.length === 0 ? (
            <p className="no-muted-sm">No sales in {period_label.toLowerCase()}.</p>
          ) : (
            daily_sales.map((d, index) => {
              const barHeight = d.revenue > 0 ? Math.max(d.value, 6) : 0;
              return (
              <div key={d.date} className="no-week-bar-wrap" title={`${d.day} · ${formatIls(d.revenue)}`}>
                <div className="no-week-bar-track">
                  <div
                    className={`no-week-bar ${index === lastActiveIndex && d.revenue > 0 ? "no-week-bar--hi" : ""}`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className="no-week-label">{d.day}</span>
                {d.sub_label && <span className="no-week-sublabel">{d.sub_label}</span>}
              </div>
            );
            })
          )}
        </div>
      </article>

      <article className="no-metric-card no-metric-card--rank">
        <div className="no-metric-head">
          <span>Best Selling Products</span>
          <span className="no-muted-sm">{period_label}</span>
        </div>
        {top_products.length === 0 ? (
          <p className="no-muted-sm">No product sales in this period.</p>
        ) : (
          <ul className="no-rank-list">
            {top_products.map((p) => (
              <li key={p.rank} className={`no-rank-item no-rank-item--${p.rank}`}>
                <div className="no-rank-thumb">{p.category === "Devices" ? "📱" : "🎧"}</div>
                <div className="no-rank-body">
                  <strong>{p.name}</strong>
                  <span>{p.orders} units · {formatIls(p.revenue)}</span>
                </div>
                <span className="no-rank-badge">#{p.rank}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

function AnalyticsView({ data }: { data: NewOrderDashboardData }) {
  return (
    <div className="no-table-grid">
      <article className="no-metric-card no-metric-card--full">
        <div className="no-metric-head"><span>Top Sellers by Units</span></div>
        <table className="no-table">
          <thead>
            <tr><th>#</th><th>Product</th><th>Units</th><th>Revenue</th></tr>
          </thead>
          <tbody>
            {data.top_products.length === 0 ? (
              <tr><td colSpan={4}>No data for {data.period_label.toLowerCase()}.</td></tr>
            ) : (
              data.top_products.map((p) => (
                <tr key={p.rank}>
                  <td>{p.rank}</td>
                  <td>{p.name}</td>
                  <td>{p.orders}</td>
                  <td>{formatIls(p.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
      <article className="no-metric-card no-metric-card--full">
        <div className="no-metric-head"><span>Top Net Revenue</span></div>
        <table className="no-table">
          <thead>
            <tr><th>#</th><th>Product</th><th>Net Revenue</th><th>Margin</th></tr>
          </thead>
          <tbody>
            {data.best_net_revenue.length === 0 ? (
              <tr><td colSpan={4}>No data for {data.period_label.toLowerCase()}.</td></tr>
            ) : (
              data.best_net_revenue.map((r, i) => (
                <tr key={r.name}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>{formatIls(r.net)}</td>
                  <td>{r.margin_pct}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
    </div>
  );
}

function ProductsView({ data }: { data: NewOrderDashboardData }) {
  const total = data.products_total ?? data.products.length;
  const catalogNote = "Full synced catalog — not filtered by period";
  return (
    <article className="no-metric-card no-metric-card--full">
      <div className="no-metric-head">
        <span>Product Catalog</span>
        <span className="no-muted-sm">
          {data.products.length.toLocaleString()} of {total.toLocaleString()} products · {catalogNote}
        </span>
      </div>
      <div className="no-table-scroll">
        <table className="no-table">
          <thead>
            <tr>
              <th>SKU</th><th>Name</th><th>Category</th><th>Cost</th><th>Price</th><th>Stock</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.products.length === 0 ? (
              <tr><td colSpan={7}>No products synced yet.</td></tr>
            ) : (
              data.products.map((p) => (
                <tr key={p.id}>
                  <td className="no-mono">{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{formatIls(p.cost)}</td>
                  <td>{formatIls(p.price)}</td>
                  <td className={p.stock <= p.min_stock! && p.min_stock != null ? "no-warn" : ""}>{p.stock}</td>
                  <td><span className={`no-tag no-tag--${p.is_active ? "ok" : "off"}`}>{p.is_active ? "Active" : "Inactive"}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function OrdersView({ data }: { data: NewOrderDashboardData }) {
  const total = data.orders_total ?? data.kpi.order_count;
  const truncated = data.orders.length < total;
  return (
    <article className="no-metric-card no-metric-card--full">
      <div className="no-metric-head">
        <span>Orders / Documents</span>
        <span className="no-muted-sm">
          {data.orders.length.toLocaleString()} of {total.toLocaleString()} in {data.period_label.toLowerCase()}
          {truncated ? " · list truncated" : ""}
        </span>
      </div>
      <div className="no-table-scroll">
        <table className="no-table">
          <thead>
            <tr><th>Document</th><th>Item</th><th>Date</th><th>Employee</th><th>Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.orders.length === 0 ? (
              <tr><td colSpan={6}>No orders in {data.period_label.toLowerCase()}.</td></tr>
            ) : (
              data.orders.map((o) => (
                <tr key={o.id}>
                  <td className="no-mono">{o.document_number}</td>
                  <td>{o.product_label}</td>
                  <td>{formatOrderDate(o.date)}</td>
                  <td>{o.employee}</td>
                  <td>{formatIls(o.total)}</td>
                  <td><span className="no-tag no-tag--ok">{o.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function formatEmployeeHours(hours: number | undefined | null): string {
  const value = Number(hours ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)}h`;
}

function EmployeesView({ data }: { data: NewOrderDashboardData }) {
  const hoursLabel = `Hours (${data.period_label})`;
  return (
    <article className="no-metric-card no-metric-card--full">
      <div className="no-metric-head"><span>Employee Performance</span></div>
      <table className="no-table">
        <thead>
          <tr><th>Employee</th><th>Sales</th><th>Orders</th><th>{hoursLabel}</th><th>Sales / Hour</th></tr>
        </thead>
        <tbody>
          {data.employees.length === 0 ? (
            <tr><td colSpan={5}>No employee sales in {data.period_label.toLowerCase()}.</td></tr>
          ) : (
            data.employees.map((e) => {
              const hours = Number(e.hours_in_period ?? 0);
              return (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{formatIls(e.sales_total)}</td>
                <td>{e.order_count}</td>
                <td>{formatEmployeeHours(hours)}</td>
                <td>{formatIls(hours > 0 ? Math.round(e.sales_total / hours) : 0)}</td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </article>
  );
}

function countAttentionNeeded(
  products: NewOrderDashboardData["products"],
): number {
  return products.filter(
    (p) =>
      p.is_stock !== false
      && p.has_min_threshold
      && p.min_stock != null
      && p.min_stock > 0
      && p.stock <= p.min_stock,
  ).length;
}

function renderView(
  view: NewOrderView,
  data: NewOrderDashboardData,
  onMinStockUpdated: (productId: string, update: { has_min_threshold: boolean; min_stock: number | null }) => void,
) {
  switch (view) {
    case "dashboard":
      return <DashboardOverview data={data} />;
    case "analytics": return <AnalyticsView data={data} />;
    case "products": return <ProductsView data={data} />;
    case "orders": return <OrdersView data={data} />;
    case "stock": return <StockView data={data} onMinStockUpdated={onMinStockUpdated} />;
    case "employees": return <EmployeesView data={data} />;
  }
}

const VIEW_META: Record<NewOrderView, { title: string; subtitle: string }> = {
  dashboard: { title: "Sales Overview", subtitle: "Your current sales summary and store activity" },
  analytics: { title: "Analytics", subtitle: "Best sellers and net revenue by period" },
  products: { title: "Products", subtitle: "Full synced catalog — SKU, cost, price and stock (not period-filtered)" },
  orders: { title: "Orders", subtitle: "All documents and invoices for the selected period" },
  stock: { title: "Stock", subtitle: "Set minimums, track attention items, and monitor inventory" },
  employees: { title: "Employees", subtitle: "Sales performance and working hours" },
};

const EMPTY_DASHBOARD: NewOrderDashboardData = {
  period: "today",
  period_label: "Today",
  since: "",
  until: null,
  chart_granularity: "hour",
  chart_title: "Revenue by Hour",
  kpi: {
    total_sales: 0,
    total_cost: 0,
    net_revenue: 0,
    units_sold: 0,
    order_count: 0,
    customer_count: 0,
    unique_customer_count: 0,
    orders_with_customer: 0,
    customer_volume_pct: 0,
    low_stock_count: 0,
    attention_needed_count: 0,
  },
  daily_sales: [],
  top_products: [],
  best_net_revenue: [],
  orders: [],
  orders_total: 0,
  products: [],
  products_total: 0,
  employees: [],
  low_stock: [],
};

export function NewOrderDashboard({ adminName, onBackToHub }: NewOrderDashboardProps) {
  const [view, setView] = useState<NewOrderView>("dashboard");
  const [syncUI, setSyncUI] = useState(getNewOrderSyncUIState);
  const [lastSync, setLastSync] = useState<NewOrderLastSync | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [configReady, setConfigReady] = useState(true);
  const [dashboard, setDashboard] = useState<NewOrderDashboardData>(EMPTY_DASHBOARD);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [period, setPeriod] = useState<NewOrderDashboardPeriod>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const fetchGenerationRef = useRef(0);
  const meta = VIEW_META[view];
  const stockAlertCount = dashboard.kpi.attention_needed_count ?? dashboard.kpi.low_stock_count;
  const filteredDashboard = filterDashboardBySearch(dashboard, view, searchQuery);
  const syncing = syncUI.syncing;
  const syncProgress = syncUI.progress;

  const handleMinStockUpdated = useCallback((
    productId: string,
    update: { has_min_threshold: boolean; min_stock: number | null },
  ) => {
    setDashboard((prev) => {
      const products = prev.products.map((p) =>
        p.id === productId
          ? { ...p, ...update }
          : p,
      );
      const attention = countAttentionNeeded(products);
      return {
        ...prev,
        products,
        kpi: {
          ...prev.kpi,
          attention_needed_count: attention,
          low_stock_count: attention,
        },
      };
    });
  }, []);

  const loadDashboard = useCallback(async (activePeriod: NewOrderDashboardPeriod) => {
    const fetchId = ++fetchGenerationRef.current;
    const activeLabel = PERIOD_TABS.find((t) => t.id === activePeriod)?.label ?? "Today";
    setDashboardLoading(true);
    setDashboardError(null);
    setDashboard((prev) => ({
      ...prev,
      period: activePeriod,
      period_label: activeLabel,
      kpi: { ...EMPTY_DASHBOARD.kpi },
      daily_sales: [],
      top_products: [],
      best_net_revenue: [],
      orders: [],
      employees: [],
    }));
    try {
      const data = await fetchNewOrderDashboard({ period: activePeriod });
      if (fetchId !== fetchGenerationRef.current) {
        return;
      }
      setDashboard(data);
    } catch (error) {
      if (fetchId !== fetchGenerationRef.current) {
        return;
      }
      setDashboardError(error instanceof Error ? error.message : "Failed to load dashboard.");
    } finally {
      if (fetchId === fetchGenerationRef.current) {
        setDashboardLoading(false);
      }
    }
  }, []);

  const handlePeriodChange = useCallback((next: NewOrderDashboardPeriod) => {
    setPeriod(next);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await fetchNewOrderStatus();
      setLastSync(status.last_sync);
      setConfigReady(status.database_configured && status.neworder_token_configured);
      if (!getNewOrderSyncUIState().syncing) {
        setSyncError(null);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Failed to load sync status.");
    }
  }, []);

  const finishSyncRun = useCallback(async () => {
    await refreshStatus();
    await loadDashboard(period);
  }, [loadDashboard, period, refreshStatus]);

  const wasSyncingRef = useRef(getNewOrderSyncUIState().syncing);

  useEffect(() => {
    return subscribeNewOrderSync((state) => {
      setSyncUI(state);
      if (state.error) {
        setSyncError(state.error);
      }
      if (wasSyncingRef.current && !state.syncing) {
        void (async () => {
          await finishSyncRun();
          if (state.lastResult?.last_sync) {
            setLastSync(state.lastResult.last_sync);
          }
          if (state.lastResult?.warnings?.length) {
            setSyncError(state.lastResult.warnings.join(" · "));
          } else if (state.lastResult?.status === "partial") {
            setSyncError("Sync finished with partial data. Run sync again to continue.");
          } else if (!state.error) {
            setSyncError(null);
          }
        })();
      }
      wasSyncingRef.current = state.syncing;
    });
  }, [finishSyncRun]);

  useEffect(() => {
    void resumeNewOrderSyncIfNeeded(SYNC_HOURS);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    void loadDashboard(period);
  }, [period, loadDashboard]);

  useEffect(() => {
    setSearchQuery("");
  }, [view]);

  function handleSync() {
    if (syncing) {
      return;
    }
    setSyncError(null);
    void startNewOrderSync(SYNC_HOURS, { forceNew: true }).catch((error) => {
      setSyncError(error instanceof Error ? error.message : "Sync failed.");
    });
  }

  return (
    <div className="no-app">
      <header className="no-header">
        <div className="no-header-start">
          <ChoosePlatformButton onClick={onBackToHub} variant="light" />
          <div className="no-header-brand">
            <img src={NEWORDER_LOGO} alt="NewOrder" className="no-header-logo" />
          </div>
        </div>

        <nav className="no-header-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              {item.label}
              {item.id === "stock" && (
                <span
                  className={`no-nav-alert${stockAlertCount > 0 ? "" : " no-nav-alert--hidden"}`}
                  aria-hidden={stockAlertCount <= 0}
                >
                  {stockAlertCount > 0 ? stockAlertCount : "0"}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="no-header-user">
          <button type="button" className="no-icon-round" title="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
            {stockAlertCount > 0 ? <span className="no-dot" /> : <span className="no-dot no-dot--hidden" aria-hidden />}
          </button>
          <div className="no-user-chip">
            <span className="no-user-avatar">{adminName.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{adminName}</strong>
              <span>Story Phone Admin</span>
            </div>
          </div>
        </div>
      </header>

      <main className="no-main">
        <div className="no-page-bar">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="no-page-actions">
            <div className="no-page-toolbar">
              <DashboardSearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={SEARCH_PLACEHOLDERS[view]}
              />
              <PeriodTimeTabs active={period} onChange={handlePeriodChange} />
            </div>
            <button type="button" className="no-btn no-btn--ghost">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M12 15l4-4M12 15l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
              Export
            </button>
            <button
              type="button"
              className={`no-btn no-btn--dark${syncing ? " no-btn--syncing" : ""}`}
              onClick={handleSync}
              disabled={syncing || !configReady}
              aria-busy={syncing}
            >
              {syncing ? "Syncing…" : "Sync NewOrder"}
            </button>
          </div>
        </div>
        <p className="no-sync-meta">
          {syncing && syncProgress ? `${syncProgress} · ` : ""}
          {syncStatusLabel(lastSync)} · Last synced: {formatLastSync(lastSync)}
          {!configReady ? " · Configure DATABASE_URL and NEWORDER_API_TOKEN on the server" : ""}
        </p>
        {syncError && <p className="no-sync-error">{syncError}</p>}
        {dashboardError && <p className="no-sync-error">{dashboardError}</p>}
        {dashboardLoading && (
          <p className="no-muted-sm">Updating {PERIOD_TABS.find((t) => t.id === period)?.label ?? "period"}…</p>
        )}
        {renderView(view, filteredDashboard, handleMinStockUpdated)}
      </main>
    </div>
  );
}
