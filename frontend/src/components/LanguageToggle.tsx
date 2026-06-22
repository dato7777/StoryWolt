import { useI18n } from "../i18n/LanguageContext";
import type { Locale } from "../i18n/translations";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  function select(next: Locale) {
    if (next !== locale) setLocale(next);
  }

  return (
    <div
      className={`relative inline-flex rounded-full border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_20px_rgba(15,23,42,0.08)] ${className}`}
      role="group"
      aria-label={t("language.toggle")}
    >
      <div
        className={`pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 shadow-lg shadow-indigo-500/30 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          locale === "he" ? "start-1 translate-x-full" : "start-1 translate-x-0"
        }`}
        aria-hidden
      />
      {(["en", "he"] as const).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => select(code)}
            className={`relative z-10 min-w-[3.25rem] rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-colors duration-300 sm:min-w-[3.5rem] sm:px-3.5 sm:text-sm ${
              active ? "text-white" : "text-slate-500 hover:text-slate-800"
            }`}
            aria-pressed={active}
          >
            {code === "en" ? "EN" : "עב"}
            <span className="sr-only">{t(`language.${code}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
