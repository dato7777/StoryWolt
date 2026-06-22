/**
 * API client for the serverless Python backend.
 */

import type { CalculationResponse, ReportTimeline } from "../types";
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
