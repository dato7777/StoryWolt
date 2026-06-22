/**
 * GitHub-style destructive confirmation for deleting a saved timeline.
 */

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n/LanguageContext";
import type { ReportTimeline } from "../types";

interface DeleteTimelineConfirmDialogProps {
  timeline: ReportTimeline;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteTimelineConfirmDialog({
  timeline,
  deleting,
  onConfirm,
  onCancel,
}: DeleteTimelineConfirmDialogProps) {
  const { t } = useI18n();
  const [confirmation, setConfirmation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const confirmPhrase = timeline.period_label;
  const canDelete = confirmation === confirmPhrase && !deleting;

  useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [deleting, onCancel]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canDelete) {
      onConfirm();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          onCancel();
        }
      }}
    >
      <div className="fixed inset-0 bg-[#1b1f24]/50" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative my-8 w-full max-w-[500px] overflow-hidden rounded-xl border border-[#d0d7de] bg-[#ffffff] shadow-[0_8px_24px_rgba(27,31,36,0.12)]"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div className="border-b border-[#d0d7de] px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffebe9] text-[#cf222e]"
                aria-hidden
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                </svg>
              </span>
              <div>
                <h2 id={titleId} className="text-base font-semibold leading-6 text-[#1f2328]">
                  {t("deleteDialog.title")}
                </h2>
                <p id={descriptionId} className="mt-2 text-sm leading-5 text-[#656d76]">
                  {t("deleteDialog.bodyStart")}{" "}
                  <span className="font-semibold text-[#1f2328]">{confirmPhrase}</span>?{" "}
                  {t("deleteDialog.bodyEnd")}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-[#d0d7de] bg-[#fff8f8] px-4 py-4 sm:px-5">
            <div className="rounded-md border border-[#ff818266] bg-[#ffebe9] px-3 py-3">
              <p className="text-sm font-semibold text-[#82071e]">{t("deleteDialog.warningTitle")}</p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-5 text-[#82071e]">
                <li>{t("deleteDialog.bullet1")}</li>
                <li>{t("deleteDialog.bullet2")}</li>
                <li>{t("deleteDialog.bullet3")}</li>
              </ul>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-5">
            <label
              htmlFor="delete-timeline-confirm"
              className="block text-sm font-normal text-[#1f2328]"
            >
              {t("deleteDialog.confirmLabel")}{" "}
              <span className="font-semibold">{confirmPhrase}</span> {t("deleteDialog.confirmSuffix")}
            </label>
            <input
              ref={inputRef}
              id="delete-timeline-confirm"
              type="text"
              autoComplete="off"
              spellCheck={false}
              disabled={deleting}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 block w-full rounded-md border border-[#d0d7de] bg-[#ffffff] px-3 py-2 text-sm text-[#1f2328] shadow-[inset_0_1px_0_rgba(27,31,36,0.04)] outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/30 disabled:cursor-not-allowed disabled:bg-[#f6f8fa] disabled:text-[#656d76]"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#d0d7de] bg-[#f6f8fa] px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              disabled={deleting}
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-md border border-[#d0d7de] bg-[#f6f8fa] px-3 py-1.5 text-sm font-medium text-[#24292f] shadow-[0_1px_0_rgba(27,31,36,0.04)] transition hover:bg-[#eef1f4] hover:border-[#c9d1d9] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canDelete}
              className="inline-flex items-center justify-center rounded-md border border-[rgba(27,31,36,0.15)] bg-[#cf222e] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(27,31,36,0.1)] transition hover:bg-[#a40e26] disabled:cursor-not-allowed disabled:border-[#d0d7de] disabled:bg-[#eaeef2] disabled:text-[#656d76] disabled:shadow-none"
            >
              {deleting ? t("common.deleting") : t("deleteDialog.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
