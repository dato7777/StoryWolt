/** Static mock data — replaced by Supabase / API sync later. */

export type NewOrderView =
  | "dashboard"
  | "analytics"
  | "products"
  | "orders"
  | "stock"
  | "employees";

export interface MockProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  isActive: boolean;
}

export interface MockOrder {
  id: string;
  documentNumber: string;
  productLabel: string;
  category: string;
  date: string;
  status: "completed" | "pending";
  total: number;
  employee: string;
}

export interface MockEmployee {
  id: string;
  name: string;
  salesTotal: number;
  orderCount: number;
  hoursThisMonth: number;
}

export const MOCK_PERIOD_LABEL = "January 2026 — June 2026";
export const MOCK_LAST_SYNC = "18 minutes ago";
export const MOCK_STOCK_ALERT_COUNT = 8;

export const MOCK_KPI = {
  totalSales: 487_592,
  totalSalesChangePct: 16,
  totalCost: 240_548,
  totalCostChangePct: -4,
  unitsSold: 847,
  unitsSoldToday: 47,
  netRevenue: 193_000,
  netRevenueChangePct: 35,
  lowStockCount: 8,
  customerCount: 120,
  customerChangePct: 16,
  customerVolumePct: 68,
};

export const MOCK_WEEKLY_SALES = [
  { day: "Mon", value: 62, change: 10 },
  { day: "Tue", value: 48, change: -4 },
  { day: "Wed", value: 71, change: 8 },
  { day: "Thu", value: 100, change: 12 },
  { day: "Fri", value: 85, change: 6 },
  { day: "Sat", value: 92, change: 9 },
  { day: "Sun", value: 55, change: -2 },
];

export const MOCK_TOP_PRODUCTS = [
  {
    rank: 1,
    name: "iPhone 15 Glass Screen Protector",
    orders: 124,
    revenue: 7316,
    category: "Accessories",
  },
  {
    rank: 2,
    name: "Samsung Galaxy A55",
    orders: 41,
    revenue: 61_090,
    category: "Devices",
  },
  {
    rank: 3,
    name: "USB-C Cable 2m",
    orders: 98,
    revenue: 4802,
    category: "Accessories",
  },
];

export const MOCK_BEST_NET_REVENUE = [
  { name: "Samsung Galaxy A55", net: 20_910, marginPct: 34.2 },
  { name: "iPhone 14 128GB", net: 18_240, marginPct: 27.3 },
  { name: "AirPods Pro 2", net: 11_160, marginPct: 31.0 },
];

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: "1",
    documentNumber: "INV246810",
    productLabel: "Samsung Galaxy A55",
    category: "Devices",
    date: "Jun 26, 2026",
    status: "completed",
    total: 1490,
    employee: "David",
  },
  {
    id: "2",
    documentNumber: "INV246809",
    productLabel: "iPhone 15 Screen Protector",
    category: "Accessories",
    date: "Jun 26, 2026",
    status: "completed",
    total: 59,
    employee: "Sarah",
  },
  {
    id: "3",
    documentNumber: "INV246808",
    productLabel: "AirPods Pro 2",
    category: "Accessories",
    date: "Jun 25, 2026",
    status: "pending",
    total: 899,
    employee: "Yossi",
  },
];

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: "p1",
    sku: "SKU875412",
    name: "Samsung Galaxy A55",
    category: "Devices",
    cost: 980,
    price: 1490,
    stock: 6,
    minStock: 3,
    isActive: true,
  },
  {
    id: "p2",
    sku: "SKU875413",
    name: "iPhone 15 Glass Screen Protector",
    category: "Accessories",
    cost: 12,
    price: 59,
    stock: 34,
    minStock: 10,
    isActive: true,
  },
  {
    id: "p3",
    sku: "SKU875414",
    name: "USB-C Cable 2m",
    category: "Accessories",
    cost: 18,
    price: 49,
    stock: 2,
    minStock: 8,
    isActive: true,
  },
  {
    id: "p4",
    sku: "SKU875415",
    name: "AirPods Pro 2",
    category: "Accessories",
    cost: 620,
    price: 899,
    stock: 4,
    minStock: 5,
    isActive: true,
  },
];

export const MOCK_EMPLOYEES: MockEmployee[] = [
  { id: "e1", name: "David", salesTotal: 84_200, orderCount: 142, hoursThisMonth: 168 },
  { id: "e2", name: "Sarah", salesTotal: 62_400, orderCount: 118, hoursThisMonth: 152 },
  { id: "e3", name: "Yossi", salesTotal: 48_900, orderCount: 96, hoursThisMonth: 144 },
];

export const NAV_ITEMS: { id: NewOrderView; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "analytics", label: "Analytics" },
  { id: "products", label: "Products" },
  { id: "orders", label: "Orders" },
  { id: "stock", label: "Stock" },
  { id: "employees", label: "Employees" },
];

export function formatIls(n: number): string {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}
