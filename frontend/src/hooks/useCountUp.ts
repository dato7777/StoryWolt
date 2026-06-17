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
): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (target == null || Number.isNaN(target)) {
      setValue(0);
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
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
