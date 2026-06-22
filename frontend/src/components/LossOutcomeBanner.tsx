import { useI18n } from "../i18n/LanguageContext";

interface LossOutcomeBannerProps {
  lossCount: number;
}

export function LossOutcomeBanner({ lossCount }: LossOutcomeBannerProps) {
  const { t } = useI18n();
  const hasLosses = lossCount > 0;

  return (
    <div
      className={`animate-fade-up opacity-0 overflow-hidden rounded-2xl border px-5 py-4 shadow-card sm:px-6 sm:py-5 ${
        hasLosses
          ? "border-red-200/90 bg-gradient-to-r from-red-50 via-rose-50/90 to-orange-50/80"
          : "border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-teal-50/90 to-sky-50/80"
      }`}
      style={{ animationDelay: "80ms" }}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
            hasLosses ? "bg-red-100" : "bg-emerald-100"
          }`}
          aria-hidden
        >
          {hasLosses ? "⚠️" : "🎸"}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`font-display text-lg font-semibold leading-snug tracking-tight sm:text-xl ${
              hasLosses ? "text-red-950" : "text-emerald-950"
            }`}
          >
            {hasLosses
              ? t("lossBanner.hasLosses", { count: lossCount })
              : t("lossBanner.noLosses")}
          </p>
          <p
            className={`mt-1.5 text-sm font-medium ${
              hasLosses ? "text-red-900/75" : "text-emerald-900/75"
            }`}
          >
            {hasLosses ? t("lossBanner.hintLosses") : t("lossBanner.hintNoLosses")}
          </p>
        </div>
      </div>
    </div>
  );
}
