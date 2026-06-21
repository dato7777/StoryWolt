import { useEffect, useRef, useState } from "react";

/** Ease-out cubic — fast start, smooth landing on target value */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate a number from 0 → target (modern KPI count-up effect).
 * Re-runs when target changes (e.g. new calculation).
 */
export function useCountUp(
  target: number | undefined | null,
  durationMs = 1100,
  options?: { enabled?: boolean; onComplete?: () => void },
): number {
  const enabled = options?.enabled ?? true;
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;

  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();
  const completedRef = useRef(false);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    completedRef.current = false;

    if (target == null || Number.isNaN(target)) {
      setValue(0);
      return;
    }

    if (!enabled) {
      setValue(target);
      return;
    }

    setValue(0);
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(target * easeOutCubic(progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, enabled]);

  return value;
}
