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

/** Dollars with cents; sub-dime values keep a third digit ("$0.085"). */
export function formatUsd(value: number): string {
  const digits = value > 0 && value < 0.1 ? 3 : 2;
  return `$${value.toFixed(digits)}`;
}

export function formatSeconds(value: number): string {
  return `${formatInteger(Math.round(value))} s`;
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

const superscripts: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

/** 0.9306 → "0.931" (macro rates are reported as fractions to three places). */
export function formatFraction(value: number, digits = 3): string {
  return value.toFixed(digits);
}

/** 0.13 → "+0.130" */
export function formatSignedFraction(value: number, digits = 3): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

/** { rate: 0.931, ci: [0.881, 0.971] } → "0.931 [0.881, 0.971]" */
export function formatMacro({ rate, ci }: { rate: number; ci: readonly [number, number] }): string {
  return `${formatFraction(rate)} [${formatFraction(ci[0])}, ${formatFraction(ci[1])}]`;
}

/** 4.0e-8 → "4.0 × 10⁻⁸" */
export function formatPValue(p: number): string {
  const exponent = Math.floor(Math.log10(p));
  if (exponent >= -2) return p.toFixed(3);
  const mantissa = (p / 10 ** exponent).toFixed(1);
  const sup = String(exponent).split("").map((ch) => superscripts[ch] ?? ch).join("");
  return `${mantissa} × 10${sup}`;
}
