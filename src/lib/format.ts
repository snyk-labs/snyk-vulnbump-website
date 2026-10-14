const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const integerFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 0.9007 → "90.1%" */
export function formatPercent(fraction: number): string {
  return percentFormat.format(fraction);
}

/** 0.7 → "70%" (for values reported only to whole percent). */
export function formatWholePercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

/** 976194 → "976.2K" */
export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

export function formatRatio(numerator: number, denominator: number): string {
  return `${formatInteger(numerator)} of ${formatInteger(denominator)}`;
}

/** Percentage-point difference between two fractions: "+12.6 pp". */
export function formatPp(a: number, b: number): string {
  const pp = (a - b) * 100;
  return `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toFixed(1)} pp`;
}

/** Long-form date for publication metadata, e.g. "11 June 2026". */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** 0.9306 → "0.931" (per-package-manager macro rates, to three places). */
export function formatFraction(value: number, digits = 3): string {
  return value.toFixed(digits);
}
