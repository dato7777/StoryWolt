/**
 * API client for the serverless Python backend.
 */

import type {
  CalculationResponse,
  OverallAnalyticsResponse,
  PeriodAnalyticsResponse,
  ReportTimeline,
} from "../types";
import { authHeaders, logoutAdmin } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface CalculatePayload {
  orderNumbersCsvText?: string;
  itemsSoldCsvText?: string;
  paymentDetailsCsvText?: string;
  orderNumbersFileName?: string;
  paymentDetailsFileName?: string;
}

/**
 * POST Wolt CSV exports to /api/calculate and return net income results.
 */
export async function calculateNetIncome(
  payload: CalculatePayload,
): Promise<CalculationResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Cannot reach the API. Start the Python dev server: python3 dev_server.py",
    );
  }

  let body: { error?: string };
  try {
    body = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "Invalid response from API."
        : "API error. Ensure python3 dev_server.py is running.",
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      logoutAdmin();
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(body.error ?? "Calculation request failed.");
  }

  return body as CalculationResponse;
}

async function parseApiResponse(response: Response): Promise<Record<string, unknown>> {
  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "Invalid response from API."
        : "API error. Ensure python3 dev_server.py is running.",
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      logoutAdmin();
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(String(body.error ?? "Request failed."));
  }

  return body;
}

/** List saved report timelines from Supabase. */
export async function fetchReportTimelines(): Promise<{
  timelines: ReportTimeline[];
  database_configured: boolean;
}> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/timelines`, {
      headers: authHeaders(),
    });
  } catch {
    throw new Error("Cannot reach the API.");
  }

  const body = await parseApiResponse(response);
  return {
    timelines: (body.timelines as ReportTimeline[]) ?? [],
    database_configured: Boolean(body.database_configured),
  };
}

/** Load a saved timeline — same shape as /api/calculate response. */
export async function fetchReportTimeline(timelineId: string): Promise<CalculationResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/timelines/${timelineId}`, {
      headers: authHeaders(),
    });
  } catch {
    throw new Error("Cannot reach the API.");
  }

  const body = await parseApiResponse(response);
  return body as unknown as CalculationResponse;
}

/** Delete a saved timeline and all related Supabase rows. */
export async function deleteReportTimeline(timelineId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/timelines/${timelineId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch {
    throw new Error("Cannot reach the API.");
  }

  await parseApiResponse(response);
}

export interface AnalyticsQuery {
  sort?: string;
  limit?: number;
  ranking?: string;
  includeAdCost?: boolean;
}

function buildAnalyticsQuery(params: AnalyticsQuery): string {
  const search = new URLSearchParams();
  if (params.sort) search.set("sort", params.sort);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.ranking) search.set("ranking", params.ranking);
  if (params.includeAdCost) search.set("include_ad_cost", "true");
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Per-timeline product performance analytics. */
export async function fetchPeriodAnalytics(
  timelineId: string,
  params: AnalyticsQuery = {},
): Promise<PeriodAnalyticsResponse> {
  const search = new URLSearchParams();
  search.set("timeline_id", timelineId);
  if (params.sort) search.set("sort", params.sort);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.ranking) search.set("ranking", params.ranking);
  if (params.includeAdCost) search.set("include_ad_cost", "true");

  const response = await fetch(`${API_BASE}/api/analytics/period?${search}`, {
    headers: authHeaders(),
  });
  const body = await parseApiResponse(response);
  return body as unknown as PeriodAnalyticsResponse;
}

/** Lifetime product performance across all saved timelines. */
export async function fetchOverallAnalytics(
  params: AnalyticsQuery = {},
): Promise<OverallAnalyticsResponse> {
  const response = await fetch(
    `${API_BASE}/api/analytics/overall${buildAnalyticsQuery(params)}`,
    { headers: authHeaders() },
  );
  const body = await parseApiResponse(response);
  return body as unknown as OverallAnalyticsResponse;
}

export interface NewOrderLastSync {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  products_upserted: number;
  documents_upserted: number;
  line_items_upserted: number;
  error_message: string | null;
}

export interface NewOrderSyncStatus {
  database_configured: boolean;
  neworder_token_configured: boolean;
  last_sync: NewOrderLastSync | null;
  sync_in_progress?: boolean;
  pending_line_items?: number;
}

export type NewOrderSyncStep = "catalog" | "customers" | "documents" | "line_items" | "employees";

export interface NewOrderSyncResult {
  ok: boolean;
  status: string;
  run_id: string;
  step?: NewOrderSyncStep;
  mode?: string;
  api_calls: number;
  branches: number;
  categories: number;
  suppliers: number;
  products_upserted: number;
  stock_rows: number;
  customers: number;
  documents_upserted: number;
  line_items_upserted: number;
  employees: number;
  attendance_rows: number;
  warnings: string[];
  has_more?: boolean;
  next_product_page?: number | null;
  next_document_task_offset?: number | null;
  documents_remaining?: number;
  last_sync?: NewOrderLastSync | null;
}

/** NewOrder sync configuration and last run metadata. */
export async function fetchNewOrderStatus(): Promise<NewOrderSyncStatus> {
  const response = await fetch(`${API_BASE}/api/neworder/status`, {
    headers: authHeaders(),
  });
  const body = await parseApiResponse(response);
  return body as unknown as NewOrderSyncStatus;
}

/** Run one chunked NewOrder sync step (commits independently). */
export async function syncNewOrderStep(options: {
  step: NewOrderSyncStep;
  hours?: number;
  runId?: string;
  productPageStart?: number;
  documentTaskOffset?: number;
  finalize?: boolean;
}): Promise<NewOrderSyncResult> {
  const response = await fetch(`${API_BASE}/api/neworder/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      step: options.step,
      hours: options.hours ?? 24,
      run_id: options.runId,
      product_page_start: options.productPageStart ?? 1,
      document_task_offset: options.documentTaskOffset ?? 0,
      finalize: options.finalize ?? false,
    }),
  });
  const body = await parseApiResponse(response);
  return body as unknown as NewOrderSyncResult;
}

const SYNC_STEP_LABELS: Record<NewOrderSyncStep, string> = {
  catalog: "Catalog",
  customers: "Customers",
  documents: "Orders",
  line_items: "Line items",
  employees: "Employees",
};

export interface NewOrderSyncCheckpoint {
  runId?: string;
  hours: number;
  stepIndex: number;
  productPage: number;
  documentTaskOffset: number;
}

export const NEWORDER_SYNC_STEP_ORDER: NewOrderSyncStep[] = [
  "catalog",
  "customers",
  "documents",
  "line_items",
  "employees",
];

/** Run all sync steps sequentially (safe for Vercel — one HTTP request per step). */
export async function runFullNewOrderSync(options?: {
  hours?: number;
  checkpoint?: NewOrderSyncCheckpoint;
  onProgress?: (message: string) => void;
  onCheckpoint?: (checkpoint: NewOrderSyncCheckpoint) => void;
}): Promise<NewOrderSyncResult> {
  const hours = options?.hours ?? 24;
  const startStepIndex = Math.max(0, options?.checkpoint?.stepIndex ?? 0);
  let runId = options?.checkpoint?.runId;
  let productPage = options?.checkpoint?.productPage ?? 1;
  let documentTaskOffset = options?.checkpoint?.documentTaskOffset ?? 0;
  const warnings: string[] = [];
  let lastResult: NewOrderSyncResult | null = null;

  const emitCheckpoint = (stepIndex: number) => {
    options?.onCheckpoint?.({
      runId,
      hours,
      stepIndex,
      productPage,
      documentTaskOffset,
    });
  };

  const report = (step: NewOrderSyncStep, detail?: string) => {
    const label = SYNC_STEP_LABELS[step];
    options?.onProgress?.(detail ? `${label}: ${detail}` : label);
  };

  for (let stepIndex = startStepIndex; stepIndex < NEWORDER_SYNC_STEP_ORDER.length; stepIndex += 1) {
    const step = NEWORDER_SYNC_STEP_ORDER[stepIndex];
    emitCheckpoint(stepIndex);

    if (step === "catalog") {
      let hasMore = true;
      while (hasMore) {
        report("catalog", `page ${productPage}`);
        const result = await syncNewOrderStep({
          step: "catalog",
          hours,
          runId,
          productPageStart: productPage,
        });
        runId = result.run_id;
        lastResult = result;
        warnings.push(...(result.warnings ?? []));
        emitCheckpoint(stepIndex);
        hasMore = Boolean(result.has_more);
        if (hasMore && result.next_product_page) {
          productPage = result.next_product_page;
        } else if (hasMore) {
          productPage += 1;
        }
      }
      productPage = 1;
      continue;
    }

    if (step === "line_items") {
      let hasMore = true;
      let batch = 0;
      while (hasMore) {
        batch += 1;
        report("line_items", `batch ${batch}`);
        const result = await syncNewOrderStep({
          step: "line_items",
          hours,
          runId,
          finalize: false,
        });
        runId = result.run_id;
        lastResult = result;
        warnings.push(...(result.warnings ?? []));
        emitCheckpoint(stepIndex);
        hasMore = Boolean(result.has_more);
      }
      continue;
    }

    if (step === "documents") {
      let hasMore = true;
      let batch = 0;
      while (hasMore) {
        batch += 1;
        report("documents", `batch ${batch}`);
        const result = await syncNewOrderStep({
          step: "documents",
          hours,
          runId,
          documentTaskOffset,
        });
        runId = result.run_id;
        lastResult = result;
        warnings.push(...(result.warnings ?? []));
        emitCheckpoint(stepIndex);
        hasMore = Boolean(result.has_more);
        if (hasMore && result.next_document_task_offset != null) {
          documentTaskOffset = result.next_document_task_offset;
        } else if (hasMore) {
          documentTaskOffset += 1;
        }
      }
      documentTaskOffset = 0;
      continue;
    }

    report(step);
    const result = await syncNewOrderStep({
      step,
      hours,
      runId,
      finalize: step === "employees",
    });
    runId = result.run_id;
    lastResult = result;
    warnings.push(...(result.warnings ?? []));
    emitCheckpoint(stepIndex);
  }

  if (!lastResult) {
    throw new Error("Sync did not start.");
  }

  return {
    ...lastResult,
    warnings: [...new Set(warnings)],
  };
}

/** Trigger a single-process NewOrder sync (best for local dev). */
export async function syncNewOrder(options?: {
  mode?: "catalog" | "sales" | "full";
  hours?: number;
}): Promise<NewOrderSyncResult> {
  const response = await fetch(`${API_BASE}/api/neworder/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      mode: options?.mode ?? "full",
      hours: options?.hours ?? 24,
    }),
  });
  const body = await parseApiResponse(response);
  return body as unknown as NewOrderSyncResult;
}

export type NewOrderDashboardPeriod = "today" | "yesterday" | "week";

export interface NewOrderDashboardKpi {
  total_sales: number;
  total_cost: number;
  net_revenue: number;
  units_sold: number;
  order_count: number;
  customer_count: number;
  unique_customer_count: number;
  orders_with_customer: number;
  customer_volume_pct: number;
  low_stock_count: number;
  attention_needed_count?: number;
}

export interface NewOrderDashboardData {
  period: NewOrderDashboardPeriod | "hours";
  period_label: string;
  since: string;
  until: string | null;
  kpi: NewOrderDashboardKpi;
  chart_granularity?: "hour" | "day";
  chart_title?: string;
  daily_sales: { day: string; sub_label?: string; date: string; revenue: number; value: number; orders?: number }[];
  top_products: {
    rank: number;
    name: string;
    category: string;
    orders: number;
    revenue: number;
  }[];
  best_net_revenue: { name: string; net: number; margin_pct: number }[];
  orders: {
    id: string;
    document_number: string;
    product_label: string;
    category: string;
    date: string;
    status: string;
    total: number;
    employee: string;
  }[];
  orders_total?: number;
  products: {
    id: string;
    sku: string;
    name: string;
    category: string;
    cost: number;
    price: number;
    stock: number;
    min_stock: number | null;
    has_min_threshold?: boolean;
    is_stock?: boolean;
    is_active: boolean;
  }[];
  products_total?: number;
  employees: {
    id: string;
    name: string;
    sales_total: number;
    order_count: number;
    hours_in_period: number;
  }[];
  low_stock: {
    id: string;
    name: string;
    sku: string;
    stock: number;
    min_stock: number;
    has_min_threshold?: boolean;
  }[];
}

function normalizeDashboardEmployee(
  row: NewOrderDashboardData["employees"][number] & { hours_this_month?: number },
): NewOrderDashboardData["employees"][number] {
  const rawHours = row.hours_in_period ?? row.hours_this_month ?? 0;
  const hours = Number(rawHours);
  return {
    ...row,
    hours_in_period: Number.isFinite(hours) ? hours : 0,
  };
}

function normalizeDashboardData(data: NewOrderDashboardData): NewOrderDashboardData {
  const orders = data.orders ?? [];
  const products = data.products ?? [];
  return {
    ...data,
    orders,
    orders_total: data.orders_total ?? data.kpi?.order_count ?? orders.length,
    products,
    products_total: data.products_total ?? products.length,
    employees: (data.employees ?? []).map((row) => normalizeDashboardEmployee(row)),
    kpi: {
      ...data.kpi,
      attention_needed_count:
        data.kpi?.attention_needed_count ?? data.kpi?.low_stock_count ?? 0,
    },
  };
}

/** Set or clear minimum stock alert threshold for a product (local config). */
export async function updateProductMinStock(
  productId: string,
  minQuantity: number | null,
): Promise<{ product_id: string; has_min_threshold: boolean; min_stock: number | null }> {
  const response = await fetch(`${API_BASE}/api/neworder/products/${productId}/min-stock`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ min_quantity: minQuantity }),
  });
  const body = await parseApiResponse(response);
  return body as {
    product_id: string;
    has_min_threshold: boolean;
    min_stock: number | null;
  };
}

/** Load NewOrder dashboard aggregates from Supabase for a calendar period. */
export async function fetchNewOrderDashboard(options?: {
  period?: NewOrderDashboardPeriod;
  hours?: number;
}): Promise<NewOrderDashboardData> {
  const params = new URLSearchParams();
  if (options?.hours != null) {
    params.set("hours", String(options.hours));
  } else {
    params.set("period", options?.period ?? "today");
  }
  const response = await fetch(`${API_BASE}/api/neworder/dashboard?${params}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  const body = await parseApiResponse(response);
  return normalizeDashboardData(body as unknown as NewOrderDashboardData);
}
