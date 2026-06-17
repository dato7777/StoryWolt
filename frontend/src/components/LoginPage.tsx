/**
 * Admin login gate — shown before the dashboard loads.
 */

import { FormEvent, useState } from "react";
import { loginAdmin } from "../api/auth";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginAdmin(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="orb -left-24 top-10 h-80 w-80 animate-orb-float bg-indigo-500/30" />
      <div
        className="orb right-0 top-1/3 h-96 w-96 animate-orb-float bg-sky-400/25"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="orb bottom-10 left-1/4 h-72 w-72 animate-orb-float bg-violet-500/20"
        style={{ animationDelay: "-10s" }}
      />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <h1 className="brand-title">Story Phone</h1>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-brand-600">
            Admin access
          </p>
          <p className="mt-2 text-base font-medium text-ink-muted">
            Sign in to open the Wolt Net Income dashboard
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="modern-panel overflow-hidden p-7 sm:p-8"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-brand-500 to-violet-500" />

          <div className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-base font-semibold text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 pr-12 text-base font-semibold text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wide text-ink-faint hover:text-brand-600"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-brand-600 to-violet-600 px-6 py-3.5 text-base font-bold text-white shadow-glow transition hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? "Signing in…" : "Sign in to dashboard"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
