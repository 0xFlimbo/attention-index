/**
 * `formatCount(42) === "42"` — plain grouped integer, no suffix.
 * Used for exact counts (post counts, category counts) where compaction would
 * hide precision.
 */
export function formatCount(value: number): string {
  return Math.trunc(value).toLocaleString("en-US");
}

const UNITS: ReadonlyArray<{ threshold: number; divisor: number; suffix: string }> = [
  { threshold: 1_000_000_000, divisor: 1_000_000_000, suffix: "B" },
  { threshold: 1_000_000, divisor: 1_000_000, suffix: "M" },
  { threshold: 1_000, divisor: 1_000, suffix: "K" },
];

/**
 * `formatCompactNumber(18_700_000) === "18.7M"` — max one decimal place, trailing
 * `.0` dropped. Below 1,000 falls back to a plain grouped integer.
 */
export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const unit = UNITS.find((candidate) => abs >= candidate.threshold);
  if (unit === undefined) return formatCount(value);

  const scaled = value / unit.divisor;
  const rounded = Math.round(scaled * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  return `${text}${unit.suffix}`;
}
