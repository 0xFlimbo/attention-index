import { z } from "zod";

/**
 * Primitives shared by every canonical data schema (docs/DATA.md §2).
 * Kept in one place so a formatting rule (date shape, ID shape, status enum)
 * only has to change once.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** True if `value`'s date portion is a real calendar date (rejects e.g. 2026-02-30). */
function isRealCalendarDate(value: string): boolean {
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * ISO date (`YYYY-MM-DD`) or full timestamp (`YYYY-MM-DDTHH:mm:ssZ`) — docs/DATA.md §2
 * allows a full timestamp only when time-of-day genuinely matters. Both forms are
 * validated against the real calendar, not just the regex shape.
 */
export const isoDateString = z
  .string()
  .refine((value) => DATE_ONLY_RE.test(value) || DATE_TIME_RE.test(value), {
    message: "must be an ISO date (YYYY-MM-DD) or timestamp (YYYY-MM-DDTHH:mm:ssZ)",
  })
  .refine(isRealCalendarDate, { message: "not a real calendar date" });

/** Absolute, public URL — docs/DATA.md §2 ("Absolute, public, canonical"). */
export const absoluteUrlString = z.string().url();

/** ISO 3166-1 alpha-2 country code — docs/DATA.md §2. */
export const countryCode = z.string().regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code");

/** Non-negative integer metric (views, likes, reposts, …) — never negative. */
export const nonNegativeInt = z.number().int().nonnegative();

/** Shared record status — docs/DATA.md §3. */
export const statusEnum = z.enum(["verified", "needs_review", "archived"]);

/**
 * Record ID: lowercase, hyphen-separated segments (docs/DATA.md §2:
 * `category-descriptor-date` or `-tweetid`). Prefix is checked per-schema.
 */
export const idShape = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase, hyphen-separated");

/** Builds an ID schema that additionally requires a given category prefix. */
export function idWithPrefix(prefix: string) {
  return idShape.refine((value) => value.startsWith(`${prefix}-`), {
    message: `id must start with "${prefix}-"`,
  });
}

/**
 * Development placeholder flag (docs/DATA.md §3). When present and `true`, the
 * record must be `needs_review` — placeholders are never shipped as verified.
 */
export const placeholderFlag = z.boolean().optional();

/** Shared refinement: `_placeholder: true` requires `status: "needs_review"`. */
export function requirePlaceholderNeedsReview<
  T extends { _placeholder?: boolean; status: string },
>(data: T, ctx: z.RefinementCtx) {
  if (data._placeholder === true && data.status !== "needs_review") {
    ctx.addIssue({
      code: "custom",
      path: ["_placeholder"],
      message: '_placeholder records must have status "needs_review"',
    });
  }
}

/**
 * Shared refinement (docs/DATA.md §12): a `verified` record must say when the
 * evidence was last checked. `verified_at` stays nullable for `needs_review` and
 * `archived` records, which may never have been checked.
 */
export function requireVerifiedAtWhenVerified<
  T extends { status: string; verified_at: string | null },
>(data: T, ctx: z.RefinementCtx) {
  if (data.status === "verified" && data.verified_at === null) {
    ctx.addIssue({
      code: "custom",
      path: ["verified_at"],
      message: 'verified records must record verified_at',
    });
  }
}

/** Both shared record refinements, applied together. */
export function applySharedRecordRules<
  T extends { _placeholder?: boolean; status: string; verified_at: string | null },
>(data: T, ctx: z.RefinementCtx) {
  requirePlaceholderNeedsReview(data, ctx);
  requireVerifiedAtWhenVerified(data, ctx);
}
