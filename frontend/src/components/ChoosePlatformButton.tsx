import { useI18n } from "../i18n/LanguageContext";

interface ChoosePlatformButtonProps {
  onClick: () => void;
  className?: string;
  /** Wolt uses dark navbar; NewOrder uses light header */
  variant?: "dark" | "light";
}

export function ChoosePlatformButton({
  onClick,
  className = "",
  variant = "dark",
}: ChoosePlatformButtonProps) {
  const { t } = useI18n();
  const isLight = variant === "light";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`app-navbar-external app-navbar-external--platforms${
        isLight ? " app-navbar-external--platforms-light" : ""
      } ${className}`.trim()}
    >
      <span
        className={`app-navbar-external-icon app-navbar-external-icon--platforms${
          isLight ? " app-navbar-external-icon--platforms-light" : ""
        }`.trim()}
        aria-hidden
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </span>
      <span className="hidden lg:inline">{t("nav.backToPlatforms")}</span>
      <span className="lg:hidden">{t("nav.backToPlatformsShort")}</span>
    </button>
  );
}
