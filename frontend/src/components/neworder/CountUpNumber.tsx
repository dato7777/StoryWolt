import { useCountUp } from "../../hooks/useCountUp";

interface CountUpNumberProps {
  value: number | undefined | null;
  durationMs?: number;
  className?: string;
  animate?: boolean;
  onComplete?: () => void;
}

/** Integer that counts up to the final value */
export function CountUpNumber({
  value,
  durationMs = 900,
  className = "",
  animate = true,
  onComplete,
}: CountUpNumberProps) {
  const animated = useCountUp(value, durationMs, { enabled: animate, onComplete });

  if (value == null || Number.isNaN(value)) {
    return <span className={className}>—</span>;
  }

  return (
    <span className={className}>
      {Math.round(animated).toLocaleString()}
    </span>
  );
}
