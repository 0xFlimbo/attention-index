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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Shared ISO parsing for both date formatters (docs/DATA.md §2 — date or timestamp). */
function isoParts(isoDate: string, formatter: string): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = isoDate.slice(0, 10).split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    Number.isNaN(year) ||
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12 ||
    yearStr === undefined ||
    dayStr === undefined
  ) {
    throw new Error(`${formatter}: not a valid ISO date: "${isoDate}"`);
  }

  return { year, month, day };
}

/**
 * `formatDate("2026-09-15") === "SEP 15 2026"` — editorial date label used across
 * archive rows, source footers and metadata. Accepts an ISO date or timestamp
 * (docs/DATA.md §2); only the date portion is used.
 */
export function formatDate(isoDate: string): string {
  const { year, month, day } = isoParts(isoDate, "formatDate");
  return `${MONTH_ABBREVIATIONS[month - 1]} ${day} ${year}`;
}

/**
 * `formatDateLong("2026-09-15") === "September 15, 2026"`.
 *
 * docs/EDITORIAL.md §4 sets `SEP 15 2026` as the UI standard and explicitly
 * allows long-form prose to use the spelled-out form instead. It exists
 * because the UI label is an all-caps token: correct in an archive row or a
 * metadata stamp, but read as shouting when it lands mid-sentence in a
 * paragraph ("recorded on SEP 16 2026"). Used only in the running prose of
 * `/methodology` and `/about`; every metadata label, including that page's
 * own `Data last updated` stamp, stays on `formatDate`.
 */
export function formatDateLong(isoDate: string): string {
  const { year, month, day } = isoParts(isoDate, "formatDateLong");
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}
