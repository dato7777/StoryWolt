/**
 * API client for the serverless Python backend.
 */

import type { CalculationResponse } from "../types";
import { authHeaders, logoutAdmin } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface CalculatePayload {
  orderNumbersCsvText?: string;
  itemsSoldCsvText?: string;
  paymentDetailsCsvText?: string;
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
