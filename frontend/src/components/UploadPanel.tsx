/**
 * Multi-file upload panel — orderNumbers (required) + itemsSold (optional).
 */

import type { ChangeEvent } from "react";
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
}: {
  label: string;
  hint: string;
  required?: boolean;
  fileName: string | null;
  disabled: boolean;
  onChange: (file: File) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a CSV file exported from Wolt.");
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
            Ready
          </span>
        )}
      </div>
      <span className="mt-1 text-xs font-medium text-ink-faint">{hint}</span>
      <span
        className={`mt-4 truncate text-sm font-semibold ${
          hasFile ? "text-emerald-800" : "text-ink-faint"
        }`}
      >
        {fileName ?? "Drop or click to select CSV"}
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
  const canCalculate = Boolean(files.orderNumbers) && !loading;
  const fileCount = [files.orderNumbers, files.itemsSold, files.paymentDetails].filter(Boolean).length;

  return (
    <section className="modern-panel p-6 sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Step 1
          </p>
          <h2 className="mt-1 text-xl font-bold text-ink">Upload Wolt exports</h2>
          <p className="mt-1 text-sm font-medium text-ink-faint">
            {fileCount} file{fileCount === 1 ? "" : "s"} selected
          </p>
        </div>

        <button
          type="button"
          disabled={!canCalculate}
          onClick={() => void onCalculate()}
          className="group relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-500 px-8 py-3.5 text-base font-bold text-white shadow-glow transition hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          <span className="relative z-10">
            {loading ? "Calculating…" : "Calculate net income"}
          </span>
          {loading && (
            <span className="absolute inset-0 animate-pulse bg-white/10" />
          )}
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <FileSlot
          label="orderNumbers.csv"
          hint="Required · delivered orders"
          required
          fileName={files.orderNumbers?.name ?? null}
          disabled={loading}
          onChange={(file) => onFilesChange({ ...files, orderNumbers: file })}
        />
        <FileSlot
          label="itemsSold.csv"
          hint="Optional · merchant SKUs"
          fileName={files.itemsSold?.name ?? null}
          disabled={loading}
          onChange={(file) => onFilesChange({ ...files, itemsSold: file })}
        />
        <FileSlot
          label="payment_details.csv"
          hint="Optional · invoice waterfall"
          fileName={files.paymentDetails?.name ?? null}
          disabled={loading}
          onChange={(file) => onFilesChange({ ...files, paymentDetails: file })}
        />
      </div>
    </section>
  );
}
