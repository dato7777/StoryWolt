import { useI18n } from "../i18n/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";

const WOLT_LOGO = "/logos/wolt.png";
const NEWORDER_LOGO = "/logos/neworder.png";

interface PlatformHubPageProps {
  onSelectWolt: () => void;
}

export function PlatformHubPage({ onSelectWolt }: PlatformHubPageProps) {
  const { t } = useI18n();

  return (
    <div className="platform-hub">
      <div className="platform-hub-bg" aria-hidden />
      <div className="platform-hub-grid" aria-hidden />
      <div className="platform-hub-glow platform-hub-glow--left" aria-hidden />
      <div className="platform-hub-glow platform-hub-glow--right" aria-hidden />

      <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
        <LanguageToggle />
      </div>

      <main className="platform-hub-content">
        <p className="platform-hub-eyebrow">{t("platformHub.eyebrow")}</p>
        <h1 className="platform-hub-title">{t("platformHub.title")}</h1>
        <p className="platform-hub-subtitle">{t("platformHub.subtitle")}</p>

        <div className="platform-hub-cards">
          <button
            type="button"
            onClick={onSelectWolt}
            className="platform-card platform-card--active group"
          >
            <span className="platform-card-ring" aria-hidden />
            <span className="platform-card-logo-wrap">
              <img
                src={WOLT_LOGO}
                alt="Wolt"
                className="platform-card-logo platform-card-logo--wolt"
                draggable={false}
              />
            </span>
            <span className="platform-card-label">{t("platformHub.wolt")}</span>
            <span className="platform-card-hint">{t("platformHub.woltHint")}</span>
          </button>

          <div className="platform-card platform-card--soon" aria-disabled="true">
            <span className="platform-card-logo-wrap platform-card-logo-wrap--muted">
              <img
                src={NEWORDER_LOGO}
                alt="NewOrder"
                className="platform-card-logo platform-card-logo--neworder"
                draggable={false}
              />
            </span>
            <span className="platform-card-label platform-card-label--muted">NewOrder</span>
            <span className="platform-card-soon">{t("platformHub.soon")}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
