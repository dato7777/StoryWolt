/**
 * Admin session token stored in sessionStorage (cleared when browser tab closes).
 */

const TOKEN_KEY = "wolt_admin_token";
const USERNAME_KEY = "wolt_admin_username";
const EXPIRES_KEY = "wolt_admin_expires_at";

export function getAuthToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresRaw = sessionStorage.getItem(EXPIRES_KEY);
  if (!token || !expiresRaw) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000) {
    clearAuthSession();
    return null;
  }
  return token;
}

export function getAuthUsername(): string | null {
  return sessionStorage.getItem(USERNAME_KEY);
}

export function saveAuthSession(token: string, expiresAt: number, username: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
  sessionStorage.setItem(USERNAME_KEY, username);
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
}

export function hasAuthSession(): boolean {
  return getAuthToken() != null;
}
