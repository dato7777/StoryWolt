import { useCountUp } from "../hooks/useCountUp";

interface CountUpCurrencyProps {
  value: number | undefined | null;
  durationMs?: number;
  className?: string;
}

/** ILS amount that counts up quickly to the final value */
export function CountUpCurrency({
  value,
  durationMs = 1100,
  className = "",
}: CountUpCurrencyProps) {
  const animated = useCountUp(value, durationMs);

  if (value == null || Number.isNaN(value)) {
    return <span className={className}>—</span>;
  }

  const formatted = new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(animated);

  return <span className={className}>{formatted}</span>;
}
