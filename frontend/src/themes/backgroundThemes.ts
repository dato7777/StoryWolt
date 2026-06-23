export const BACKGROUND_THEME_IDS = [
  "frosted-saas",
  "warm-paper",
  "aurora-light",
  "layered-depth",
] as const;

export type BackgroundThemeId = (typeof BACKGROUND_THEME_IDS)[number];

export const DEFAULT_BACKGROUND_THEME: BackgroundThemeId = "frosted-saas";

export const BACKGROUND_THEME_STORAGE_KEY = "wolt_dashboard_bg_theme";

export function isBackgroundThemeId(value: string): value is BackgroundThemeId {
  return (BACKGROUND_THEME_IDS as readonly string[]).includes(value);
}

export function readStoredBackgroundTheme(): BackgroundThemeId {
  try {
    const stored = localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY);
    if (stored && isBackgroundThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_BACKGROUND_THEME;
}
