import { useI18n } from "../i18n/LanguageContext";

interface UploadSuccessCardProps {
  periodLabel: string | null;
  onGoToReports: () => void;
  onUploadAnother: () => void;
}

export function UploadSuccessCard({
  periodLabel,
  onGoToReports,
  onUploadAnother,
}: UploadSuccessCardProps) {
  const { t } = useI18n();

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-lg shadow-emerald-500/10 sm:p-8"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-teal-400/20 blur-2xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
          aria-hidden
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            {t("upload.successBadge")}
          </p>
          <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{t("upload.successTitle")}</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-ink-muted sm:text-base">
            {periodLabel
              ? t("upload.successBodyWithPeriod", { period: periodLabel })
              : t("upload.successBody")}
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onGoToReports}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] hover:shadow-xl sm:text-base"
            >
              {t("upload.goToReports")}
              <span aria-hidden>→</span>
            </button>
            <button
              type="button"
              onClick={onUploadAnother}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-ink-muted transition hover:border-slate-300 hover:bg-slate-50 sm:text-base"
            >
              {t("upload.uploadAnother")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
