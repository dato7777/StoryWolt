import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/LanguageContext";
import {
  BACKGROUND_THEME_IDS,
  type BackgroundThemeId,
} from "../themes/backgroundThemes";
import { useBackgroundTheme } from "../themes/BackgroundThemeContext";

const SWATCH_CLASS: Record<BackgroundThemeId, string> = {
  "frosted-saas": "bg-theme-swatch-frosted",
  "warm-paper": "bg-theme-swatch-warm",
  "aurora-light": "bg-theme-swatch-aurora",
  "layered-depth": "bg-theme-swatch-layered",
};

const MENU_WIDTH = 288;
const MENU_GAP = 8;

export function BackgroundThemePicker({ className = "" }: { className?: string }) {
  const { t, isRtl } = useI18n();
  const { theme, setTheme } = useBackgroundTheme();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    const menuHeight = menuRef.current?.offsetHeight ?? 320;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const openAbove = spaceBelow < Math.min(menuHeight, 200) && rect.top > spaceBelow;

    const top = openAbove
      ? Math.max(MENU_GAP, rect.top - MENU_GAP - menuHeight)
      : rect.bottom + MENU_GAP;

    const style: CSSProperties = {
      position: "fixed",
      top,
      width,
      zIndex: 250,
    };

    if (isRtl) {
      style.left = Math.max(MENU_GAP, Math.min(rect.left, window.innerWidth - width - MENU_GAP));
    } else {
      style.right = Math.max(MENU_GAP, window.innerWidth - rect.right);
    }

    setMenuStyle(style);
  }, [isRtl]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const raf = window.requestAnimationFrame(updateMenuPosition);

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, updateMenuPosition]);

  const menu = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-theme-picker-menu overflow-hidden rounded-2xl border shadow-2xl"
      role="listbox"
      aria-label={t("backgroundTheme.toggle")}
    >
      <div className="border-b px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-faint">
          {t("backgroundTheme.label")}
        </p>
        <p className="mt-0.5 text-sm font-medium text-ink-muted">{t("backgroundTheme.hint")}</p>
      </div>
      <ul className="max-h-[min(20rem,60vh)] overflow-y-auto p-2">
        {BACKGROUND_THEME_IDS.map((id) => {
          const active = theme === id;
          return (
            <li key={id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setTheme(id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition ${
                  active ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className={`mt-0.5 h-9 w-9 shrink-0 rounded-xl ring-1 ring-black/5 ${SWATCH_CLASS[id]}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">
                    {t(`backgroundTheme.${id}.name`)}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium leading-snug text-ink-muted">
                    {t(`backgroundTheme.${id}.description`)}
                  </span>
                </span>
                {active && (
                  <span className="ms-auto mt-1 text-indigo-600" aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ) : null;

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="bg-theme-picker-trigger inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition sm:px-3.5 sm:py-2 sm:text-sm"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("backgroundTheme.toggle")}
      >
        <span className={`h-5 w-5 shrink-0 rounded-full ring-2 ring-white/80 ${SWATCH_CLASS[theme]}`} />
        <span className="hidden max-w-[6.5rem] truncate text-ink-muted sm:inline">
          {t(`backgroundTheme.${theme}.short`)}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-ink-faint transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  );
}
