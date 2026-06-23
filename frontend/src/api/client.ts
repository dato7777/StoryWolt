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
