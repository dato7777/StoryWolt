import { useI18n } from "../i18n/LanguageContext";

export type AppView = "reports" | "uploads" | "report" | "analytics";

interface AppNavbarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  reportPeriodLabel: string | null;
  hasReport: boolean;
  databaseConfigured: boolean;
}

export function AppNavbar({
  activeView,
  onNavigate,
  reportPeriodLabel,
  hasReport,
  databaseConfigured,
}: AppNavbarProps) {
  const { t } = useI18n();

  const items: Array<{
    id: AppView;
    label: string;
    badge?: string | null;
    disabled?: boolean;
    hidden?: boolean;
  }> = [
    { id: "reports", label: t("nav.reports") },
    { id: "uploads", label: t("nav.uploads") },
    {
      id: "report",
      label: t("nav.periodReport"),
      badge: reportPeriodLabel,
      disabled: !hasReport,
    },
    {
      id: "analytics",
      label: t("nav.analytics"),
      hidden: !databaseConfigured,
    },
  ];

  return (
    <nav
      className="relative border-b border-white/40 bg-white/60 backdrop-blur-xl"
      aria-label={t("nav.ariaLabel")}
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2.5 sm:gap-2 sm:px-6">
        {items
          .filter((item) => !item.hidden)
          .map((item) => {
            const isActive = activeView === item.id;
            const disabled = item.disabled;

            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onNavigate(item.id)}
                className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all duration-200 sm:px-4 sm:py-2.5 sm:text-base ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                    : disabled
                      ? "cursor-not-allowed text-ink-faint/50"
                      : "text-ink-muted hover:bg-white/80 hover:text-indigo-700"
                }`}
              >
                {item.label}
                {item.badge && !disabled && (
                  <span
                    className={`max-w-[8rem] truncate rounded-full px-2 py-0.5 text-[10px] font-bold sm:max-w-[10rem] sm:text-xs ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </nav>
  );
}
