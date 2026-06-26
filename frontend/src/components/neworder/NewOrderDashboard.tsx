import { useState } from "react";
import { ChoosePlatformButton } from "../ChoosePlatformButton";
import {
  MOCK_BEST_NET_REVENUE,
  MOCK_EMPLOYEES,
  MOCK_KPI,
  MOCK_LAST_SYNC,
  MOCK_ORDERS,
  MOCK_PERIOD_LABEL,
  MOCK_PRODUCTS,
  MOCK_STOCK_ALERT_COUNT,
  MOCK_TOP_PRODUCTS,
  MOCK_WEEKLY_SALES,
  NAV_ITEMS,
  formatIls,
  type NewOrderView,
} from "../../data/neworderMockData";

const NEWORDER_LOGO = "/logos/neworder.png";

interface NewOrderDashboardProps {
  adminName: string;
  onBackToHub: () => void;
}

function CustomerTachometer() {
  const segments = 32;
  const cx = 100;
  const cy = 98;
  const innerR = 52;
  const outerR = 78;
  const startAngle = -180;
  const endAngle = 0;
  const filledCount = Math.round(segments * (MOCK_KPI.customerVolumePct / 100));

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
            />
          );
        })}
      </svg>
      <div className="no-tachometer-center">
        <strong>{MOCK_KPI.customerCount}</strong>
        <span>New Customers</span>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const maxBar = Math.max(...MOCK_WEEKLY_SALES.map((d) => d.value));
  const highlightDay = "Thu";

  return (
    <div className="no-dash-grid">
      <div className="no-dash-col no-dash-col--sales">
        <article className="no-metric-card no-metric-card--dark">
          <div className="no-metric-head">
            <span>Total Sales</span>
            <button type="button" className="no-dots" aria-label="Options">···</button>
          </div>
          <strong>{formatIls(MOCK_KPI.totalSales)}</strong>
          <span className="no-pill no-pill--up">+{MOCK_KPI.totalSalesChangePct}% vs last month</span>
        </article>
        <article className="no-metric-card">
          <div className="no-metric-head">
            <span>Total Cost</span>
            <button type="button" className="no-dots" aria-label="Options">···</button>
          </div>
          <strong className="no-metric-dark">{formatIls(MOCK_KPI.totalCost)}</strong>
          <span className="no-pill no-pill--down">{MOCK_KPI.totalCostChangePct}% vs last month</span>
        </article>
      </div>

      <article className="no-metric-card no-metric-card--wide">
        <div className="no-metric-head">
          <span>Units Sold</span>
          <div className="no-time-tabs">
            {["Today", "Week", "Month"].map((t, i) => (
              <button key={t} type="button" className={i === 1 ? "active" : ""}>{t}</button>
            ))}
          </div>
        </div>
        <strong className="no-metric-dark">{MOCK_KPI.unitsSold.toLocaleString()}</strong>
        <span className="no-pill no-pill--up">+{MOCK_KPI.netRevenueChangePct}% vs last month</span>
        <div className="no-progress-track">
          <div className="no-progress-fill" style={{ width: "68%" }} />
        </div>
        <div className="no-progress-foot">
          <span>Net revenue {formatIls(MOCK_KPI.netRevenue)}</span>
          <span className="no-pill no-pill--up no-pill--sm">+{MOCK_KPI.unitsSoldToday} today</span>
        </div>
      </article>

      <article className="no-metric-card no-metric-card--gauge">
        <div className="no-metric-head"><span>Customers Volume</span></div>
        <CustomerTachometer />
        <p className="no-gauge-note">
          Your customer volume has increased
          <span className="no-pill no-pill--up no-pill--sm">+{MOCK_KPI.customerChangePct}%</span>
        </p>
      </article>

      <article className="no-metric-card no-metric-card--chart">
        <div className="no-metric-head">
          <span>Weekly Revenue</span>
          <div className="no-chart-tabs">
            <button type="button" className="active">Sales</button>
            <button type="button">Margin</button>
            <select className="no-mini-select" defaultValue="weekly">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <p className="no-chart-lead">
          <strong>+{MOCK_KPI.totalSalesChangePct}%</strong>
          Revenue trending up this week
        </p>
        <div className="no-week-bars">
          {MOCK_WEEKLY_SALES.map((d) => (
            <div key={d.day} className="no-week-bar-wrap">
              <span className={`no-bar-badge ${d.change >= 0 ? "up" : "down"}`}>
                {d.change >= 0 ? "+" : ""}{d.change}%
              </span>
              <div
                className={`no-week-bar ${d.day === highlightDay ? "no-week-bar--hi" : ""}`}
                style={{ height: `${(d.value / maxBar) * 100}%` }}
              />
              <span className="no-week-label">{d.day}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="no-metric-card no-metric-card--rank">
        <div className="no-metric-head">
          <span>Best Selling Products</span>
          <span className="no-muted-sm">Last 30 days</span>
        </div>
        <ul className="no-rank-list">
          {MOCK_TOP_PRODUCTS.map((p) => (
            <li key={p.rank} className={`no-rank-item no-rank-item--${p.rank}`}>
              <div className="no-rank-thumb">{p.category === "Devices" ? "📱" : "🎧"}</div>
              <div className="no-rank-body">
                <strong>{p.name}</strong>
                <span>{p.orders} orders · {formatIls(p.revenue)}</span>
              </div>
              <span className="no-rank-badge">#{p.rank}</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="no-table-grid">
      <article className="no-metric-card no-metric-card--full">
        <div className="no-metric-head"><span>Top Sellers by Units</span></div>
        <table className="no-table">
          <thead>
            <tr><th>#</th><th>Product</th><th>Units</th><th>Revenue</th></tr>
          </thead>
          <tbody>
            {MOCK_TOP_PRODUCTS.map((p) => (
              <tr key={p.name}>
                <td>{p.rank}</td>
                <td>{p.name}</td>
                <td>{p.orders}</td>
                <td>{formatIls(p.revenue)}</td>
              </tr>
            ))}
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
            {MOCK_BEST_NET_REVENUE.map((r, i) => (
              <tr key={r.name}>
                <td>{i + 1}</td>
                <td>{r.name}</td>
                <td>{formatIls(r.net)}</td>
                <td>{r.marginPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}

function ProductsView() {
  return (
    <article className="no-metric-card no-metric-card--full">
      <div className="no-metric-head"><span>Product Catalog</span></div>
      <div className="no-table-scroll">
        <table className="no-table">
          <thead>
            <tr>
              <th>SKU</th><th>Name</th><th>Category</th><th>Cost</th><th>Price</th><th>Stock</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PRODUCTS.map((p) => (
              <tr key={p.id}>
                <td className="no-mono">{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{formatIls(p.cost)}</td>
                <td>{formatIls(p.price)}</td>
                <td className={p.stock <= p.minStock ? "no-warn" : ""}>{p.stock}</td>
                <td><span className={`no-tag no-tag--${p.isActive ? "ok" : "off"}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function OrdersView() {
  return (
    <article className="no-metric-card no-metric-card--full">
      <div className="no-metric-head"><span>Recent Orders / Documents</span></div>
      <div className="no-table-scroll">
        <table className="no-table">
          <thead>
            <tr><th>Document</th><th>Item</th><th>Date</th><th>Employee</th><th>Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {MOCK_ORDERS.map((o) => (
              <tr key={o.id}>
                <td className="no-mono">{o.documentNumber}</td>
                <td>{o.productLabel}</td>
                <td>{o.date}</td>
                <td>{o.employee}</td>
                <td>{formatIls(o.total)}</td>
                <td><span className={`no-tag no-tag--${o.status === "completed" ? "ok" : "pending"}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function StockView() {
  const low = MOCK_PRODUCTS.filter((p) => p.stock <= p.minStock);
  return (
    <div className="no-table-grid">
      <article className="no-metric-card no-metric-card--dark no-metric-card--full">
        <span className="no-pill no-pill--down">Stock Alert</span>
        <h3 className="no-alert-title">{low.length} products below minimum stock</h3>
        <ul className="no-alert-list">
          {low.map((p) => (
            <li key={p.id}>{p.name} — {p.stock} in stock (min {p.minStock})</li>
          ))}
        </ul>
      </article>
      <article className="no-metric-card no-metric-card--full">
        <div className="no-metric-head"><span>Stock by Product</span></div>
        <table className="no-table">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Stock</th><th>Minimum</th><th>Status</th></tr>
          </thead>
          <tbody>
            {MOCK_PRODUCTS.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="no-mono">{p.sku}</td>
                <td>{p.stock}</td>
                <td>{p.minStock}</td>
                <td>
                  {p.stock === 0 ? (
                    <span className="no-tag no-tag--danger">Out</span>
                  ) : p.stock <= p.minStock ? (
                    <span className="no-tag no-tag--pending">Low</span>
                  ) : (
                    <span className="no-tag no-tag--ok">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}

function EmployeesView() {
  return (
    <article className="no-metric-card no-metric-card--full">
      <div className="no-metric-head"><span>Employee Performance</span></div>
      <table className="no-table">
        <thead>
          <tr><th>Employee</th><th>Sales</th><th>Orders</th><th>Hours (month)</th><th>Sales / Hour</th></tr>
        </thead>
        <tbody>
          {MOCK_EMPLOYEES.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{formatIls(e.salesTotal)}</td>
              <td>{e.orderCount}</td>
              <td>{e.hoursThisMonth}h</td>
              <td>{formatIls(Math.round(e.salesTotal / e.hoursThisMonth))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function renderView(view: NewOrderView) {
  switch (view) {
    case "dashboard": return <DashboardOverview />;
    case "analytics": return <AnalyticsView />;
    case "products": return <ProductsView />;
    case "orders": return <OrdersView />;
    case "stock": return <StockView />;
    case "employees": return <EmployeesView />;
  }
}

const VIEW_META: Record<NewOrderView, { title: string; subtitle: string }> = {
  dashboard: { title: "Sales Overview", subtitle: "Your current sales summary and store activity" },
  analytics: { title: "Analytics", subtitle: "Best sellers and net revenue by period" },
  products: { title: "Products", subtitle: "Catalog with SKU, cost, price and stock" },
  orders: { title: "Orders", subtitle: "Documents and invoices from NewOrder" },
  stock: { title: "Stock", subtitle: "Inventory levels and low-stock alerts" },
  employees: { title: "Employees", subtitle: "Sales performance and working hours" },
};

export function NewOrderDashboard({ adminName, onBackToHub }: NewOrderDashboardProps) {
  const [view, setView] = useState<NewOrderView>("dashboard");
  const [syncing, setSyncing] = useState(false);
  const meta = VIEW_META[view];

  function handleSync() {
    setSyncing(true);
    window.setTimeout(() => setSyncing(false), 1500);
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
              {item.id === "stock" && MOCK_STOCK_ALERT_COUNT > 0 && (
                <span className="no-nav-alert">{MOCK_STOCK_ALERT_COUNT}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="no-header-user">
          <button type="button" className="no-icon-round" title="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
            {MOCK_STOCK_ALERT_COUNT > 0 && <span className="no-dot" />}
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
            <select className="no-select" defaultValue={MOCK_PERIOD_LABEL}>
              <option>{MOCK_PERIOD_LABEL}</option>
            </select>
            <button type="button" className="no-btn no-btn--ghost">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M12 15l4-4M12 15l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
              Export
            </button>
            <button type="button" className="no-btn no-btn--dark" onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync NewOrder"}
            </button>
          </div>
        </div>
        <p className="no-sync-meta">Last synced: {MOCK_LAST_SYNC} · Mock data preview</p>
        {renderView(view)}
      </main>
    </div>
  );
}
