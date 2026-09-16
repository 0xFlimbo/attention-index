const MONTH_ABBREVIATIONS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/**
 * `formatDate("2026-09-15") === "SEP 15 2026"` — editorial date label used across
 * archive rows, source footers and metadata. Accepts an ISO date or timestamp
 * (docs/DATA.md §2); only the date portion is used.
 */
export function formatDate(isoDate: string): string {
  const [yearStr, monthStr, dayStr] = isoDate.slice(0, 10).split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const monthName = MONTH_ABBREVIATIONS[month - 1];
  if (monthName === undefined || Number.isNaN(year) || Number.isNaN(day)) {
    throw new Error(`formatDate: not a valid ISO date: "${isoDate}"`);
  }

  return `${monthName} ${day} ${year}`;
}
