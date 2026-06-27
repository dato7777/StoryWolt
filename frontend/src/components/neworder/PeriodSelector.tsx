import { useCallback, useEffect, useRef, useState } from "react";

export type PeriodSelection =
  | { mode: "today" }
  | { mode: "yesterday" }
  | { mode: "range"; from: string; to: string };

function isoDateLocal(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoDateLocal(d);
}

function defaultRange(): { from: string; to: string } {
  return { from: daysAgoIso(6), to: isoDateLocal() };
}

function formatRangePreview(from: string, to: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function periodSelectionKey(selection: PeriodSelection): string {
  if (selection.mode === "range") {
    return `range:${selection.from}:${selection.to}`;
  }
  return selection.mode;
}

export function periodSelectionLabel(selection: PeriodSelection): string {
  switch (selection.mode) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "range":
      return formatRangePreview(selection.from, selection.to);
  }
}

interface PeriodSelectorProps {
  value: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
  disabled?: boolean;
}

export function PeriodSelector({ value, onChange, disabled }: PeriodSelectorProps) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(
    value.mode === "range" ? value.from : defaultRange().from,
  );
  const [draftTo, setDraftTo] = useState(
    value.mode === "range" ? value.to : defaultRange().to,
  );
  const [rangeError, setRangeError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rangeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (value.mode === "range") {
      setDraftFrom(value.from);
      setDraftTo(value.to);
    }
  }, [value]);

  useEffect(() => {
    if (!rangeOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || rangeBtnRef.current?.contains(target)) {
        return;
      }
      setRangeOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [rangeOpen]);

  const applyRange = useCallback(() => {
    if (!draftFrom || !draftTo) {
      setRangeError("Choose both dates.");
      return;
    }
    if (draftTo < draftFrom) {
      setRangeError("End date must be on or after start date.");
      return;
    }
    setRangeError(null);
    onChange({ mode: "range", from: draftFrom, to: draftTo });
    setRangeOpen(false);
  }, [draftFrom, draftTo, onChange]);

  const toggleRange = useCallback(() => {
    setRangeOpen((wasOpen) => {
      if (wasOpen) return false;
      if (value.mode === "range") {
        setDraftFrom(value.from);
        setDraftTo(value.to);
      } else {
        const defaults = defaultRange();
        setDraftFrom(defaults.from);
        setDraftTo(defaults.to);
      }
      setRangeError(null);
      return true;
    });
  }, [value]);

  const selectPreset = useCallback(
    (mode: "today" | "yesterday") => {
      setRangeOpen(false);
      setRangeError(null);
      onChange({ mode });
    },
    [onChange],
  );

  const rangeActive = value.mode === "range" || rangeOpen;

  return (
    <div className="no-period-selector">
      <div className="no-period-presets">
        <button
          type="button"
          className={value.mode === "today" ? "active" : ""}
          disabled={disabled}
          onClick={() => selectPreset("today")}
        >
          Today
        </button>
        <button
          type="button"
          className={value.mode === "yesterday" ? "active" : ""}
          disabled={disabled}
          onClick={() => selectPreset("yesterday")}
        >
          Yesterday
        </button>
        <button
          ref={rangeBtnRef}
          type="button"
          className={rangeActive ? "active" : ""}
          disabled={disabled}
          onClick={toggleRange}
          aria-expanded={rangeOpen}
          aria-haspopup="dialog"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Custom range
        </button>
      </div>

      {rangeOpen && (
        <div
          ref={panelRef}
          className="no-date-range-panel"
          role="dialog"
          aria-label="Custom date range"
        >
          <div className="no-date-range-fields">
            <label className="no-date-field">
              <span>From</span>
              <input
                type="date"
                value={draftFrom}
                max={draftTo || isoDateLocal()}
                disabled={disabled}
                onChange={(e) => {
                  setDraftFrom(e.target.value);
                  setRangeError(null);
                }}
              />
            </label>
            <span className="no-date-range-arrow" aria-hidden>→</span>
            <label className="no-date-field">
              <span>To</span>
              <input
                type="date"
                value={draftTo}
                min={draftFrom}
                max={isoDateLocal()}
                disabled={disabled}
                onChange={(e) => {
                  setDraftTo(e.target.value);
                  setRangeError(null);
                }}
              />
            </label>
          </div>
          <button
            type="button"
            className="no-date-range-apply"
            disabled={disabled}
            onClick={applyRange}
          >
            Apply range
          </button>
          {rangeError && <p className="no-date-range-error">{rangeError}</p>}
          {value.mode === "range" && !rangeError && (
            <p className="no-date-range-hint">
              Current: {formatRangePreview(value.from, value.to)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
