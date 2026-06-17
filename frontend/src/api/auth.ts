/**
 * Admin login API client.
 */

import { clearAuthSession, getAuthToken, saveAuthSession } from "../auth/session";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface LoginResponse {
  token: string;
  expiresAt: number;
  username: string;
}

export async function loginAdmin(
  username: string,
  password: string,
): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error(
      "Cannot reach the API. Start the Python dev server: python3 dev_server.py",
    );
  }

  let body: { error?: string; token?: string; expiresAt?: number; username?: string };
  try {
    body = await response.json();
  } catch {
    throw new Error("Invalid response from login API.");
  }

  if (!response.ok) {
    throw new Error(body.error ?? "Login failed.");
  }

  if (!body.token || body.expiresAt == null || !body.username) {
    throw new Error("Login API returned an incomplete session.");
  }

  const session: LoginResponse = {
    token: body.token,
    expiresAt: body.expiresAt,
    username: body.username,
  };
  saveAuthSession(session.token, session.expiresAt, session.username);
  return session;
}

export async function verifySession(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/api/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      clearAuthSession();
      return false;
    }
    const body = (await response.json()) as { authenticated?: boolean };
    if (!body.authenticated) {
      clearAuthSession();
      return false;
    }
    return true;
  } catch {
    // Offline / dev server down — trust local token until next API call
    return true;
  }
}

export function logoutAdmin(): void {
  clearAuthSession();
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
