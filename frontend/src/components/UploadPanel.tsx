/**
 * Multi-file upload panel — orderNumbers (required) + standardSummary (optional).
 */

import type { ChangeEvent } from "react";
import { useI18n } from "../i18n/LanguageContext";
import type { UploadFiles } from "../types";

interface UploadPanelProps {
  files: UploadFiles;
  onFilesChange: (files: UploadFiles) => void;
  onCalculate: () => Promise<void>;
  loading: boolean;
}

function FileSlot({
  label,
  hint,
  required,
  fileName,
  disabled,
  onChange,
  readyLabel,
  dropLabel,
  csvAlert,
}: {
  label: string;
  hint: string;
  required?: boolean;
  fileName: string | null;
  disabled: boolean;
  onChange: (file: File) => void;
  readyLabel: string;
  dropLabel: string;
  csvAlert: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert(csvAlert);
      return;
    }
    onChange(file);
  }

  const hasFile = Boolean(fileName);

  return (
    <label
      className={`group flex flex-1 cursor-pointer flex-col rounded-2xl border-2 border-dashed px-5 py-5 transition-all duration-300 ${
        hasFile
          ? "border-emerald-300 bg-emerald-50/50 hover:border-emerald-400"
          : "border-slate-200 bg-slate-50/50 hover:border-brand-400 hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-ink">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        {hasFile && (
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {readyLabel}
          </span>
        )}
      </div>
      <span className="mt-1 text-xs font-medium text-ink-faint">{hint}</span>
      <span
        className={`mt-4 truncate text-sm font-semibold ${
          hasFile ? "text-emerald-800" : "text-ink-faint"
        }`}
      >
        {fileName ?? dropLabel}
      </span>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
    </label>
  );
}

export function UploadPanel({
  files,
  onFilesChange,
  onCalculate,
  loading,
}: UploadPanelProps) {
  const { t } = useI18n();
  const hasOrderNumbers = Boolean(files.orderNumbers);
  const hasSummary = Boolean(files.paymentDetails);
  const canCalculate = hasOrderNumbers && hasSummary && !loading;
  const fileCount = [files.orderNumbers, files.paymentDetails].filter(Boolean).length;

  return (
    <section className="modern-panel p-6 sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            {t("upload.step")}
          </p>
          <h2 className="mt-1 text-xl font-bold text-ink">{t("upload.title")}</h2>
          <p className="mt-1 text-sm font-medium text-ink-faint">{t("upload.subtitle")}</p>
          <p className="mt-2 text-sm font-semibold text-ink-muted">
            {t("upload.filesSelected", { count: fileCount })}
          </p>
          {!canCalculate && !loading && (
            <p className="mt-1 text-xs font-medium text-amber-700">{t("upload.bothFilesHint")}</p>
          )}
        </div>

        <button
          type="button"
          disabled={!canCalculate}
          onClick={() => void onCalculate()}
          className="group relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-500 px-8 py-3.5 text-base font-bold text-white shadow-glow transition hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          <span className="relative z-10">
            {loading ? t("upload.calculating") : t("upload.calculate")}
          </span>
          {loading && <span className="absolute inset-0 animate-pulse bg-white/10" />}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FileSlot
          label="orderNumbers.csv"
          hint={t("upload.orderNumbersHint")}
          required
          fileName={files.orderNumbers?.name ?? null}
          disabled={loading}
          onChange={(file) => onFilesChange({ ...files, orderNumbers: file })}
          readyLabel={t("upload.ready")}
          dropLabel={t("upload.dropCsv")}
          csvAlert={t("upload.csvOnly")}
        />
        <FileSlot
          label="standardSummary.csv"
          hint={t("upload.summaryHint")}
          required
          fileName={files.paymentDetails?.name ?? null}
          disabled={loading}
          onChange={(file) => onFilesChange({ ...files, paymentDetails: file })}
          readyLabel={t("upload.ready")}
          dropLabel={t("upload.dropCsv")}
          csvAlert={t("upload.csvOnly")}
        />
      </div>
    </section>
  );
}
