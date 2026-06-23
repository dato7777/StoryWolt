import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BACKGROUND_THEME_STORAGE_KEY,
  DEFAULT_BACKGROUND_THEME,
  readStoredBackgroundTheme,
  type BackgroundThemeId,
} from "./backgroundThemes";

interface BackgroundThemeContextValue {
  theme: BackgroundThemeId;
  setTheme: (theme: BackgroundThemeId) => void;
}

const BackgroundThemeContext = createContext<BackgroundThemeContextValue | null>(null);

export function BackgroundThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BackgroundThemeId>(readStoredBackgroundTheme);

  const setTheme = useCallback((next: BackgroundThemeId) => {
    setThemeState(next);
    try {
      localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.bgTheme = theme;
    if (!document.documentElement.dataset.bgTheme) {
      document.documentElement.dataset.bgTheme = DEFAULT_BACKGROUND_THEME;
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <BackgroundThemeContext.Provider value={value}>{children}</BackgroundThemeContext.Provider>
  );
}

export function useBackgroundTheme(): BackgroundThemeContextValue {
  const ctx = useContext(BackgroundThemeContext);
  if (!ctx) {
    throw new Error("useBackgroundTheme must be used within BackgroundThemeProvider");
  }
  return ctx;
}
