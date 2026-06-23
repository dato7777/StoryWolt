import { useI18n } from "../i18n/LanguageContext";

export type AppView = "reports" | "uploads" | "report" | "analytics";

const STORYPHONE_URL = "https://storyphone.co.il/";

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

  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <nav className="app-navbar" aria-label={t("nav.ariaLabel")}>
      <div className="app-navbar-glow" aria-hidden />
      <div className="app-navbar-inner">
        <div className="hidden w-[9.5rem] shrink-0 sm:block" aria-hidden />

        <div className="flex min-w-0 flex-1 justify-center overflow-x-auto">
          <div className="app-navbar-track">
            {visibleItems.map((item) => {
              const isActive = activeView === item.id;
              const disabled = item.disabled;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onNavigate(item.id)}
                  className={`app-navbar-item ${isActive ? "is-active" : ""} ${
                    disabled ? "is-disabled" : ""
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {item.label}
                    {item.badge && !disabled && (
                      <span className="app-navbar-badge">{item.badge}</span>
                    )}
                  </span>
                  {isActive && <span className="app-navbar-item-glow" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex w-[9.5rem] shrink-0 justify-end">
          <a
            href={STORYPHONE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="app-navbar-external"
          >
            <span className="app-navbar-external-icon" aria-hidden>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
            <span className="hidden sm:inline">{t("nav.toStoryPhone")}</span>
            <span className="sm:hidden">StoryPhone</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
