import type { Post } from "@/schemas/post.schema";
import type { Amplification } from "@/schemas/amplification.schema";
import type { MediaReference } from "@/schemas/media.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { latestObservation } from "@/lib/metrics/observation";

/**
 * docs/DATA.md §9, §10 — the last-update dates are read off the dataset
 * itself ("store the evidence, derive the number"), never typed into
 * `project.json`, where a hand-kept date drifts from the data it describes.
 *
 * Both return an ISO date (`YYYY-MM-DD`), truncated from a full timestamp
 * when a source record carries one (docs/DATA.md §2 allows either), or
 * `null` when nothing eligible exists to date. Callers must omit the date
 * element rather than invent one for the `null` case.
 */

/**
 * The date of the headline views figure: the latest `observed_at` across
 * every verified, non-placeholder post's observation history. This is what
 * the Primary Attention Metric's LAST UPDATED means — the day the number
 * above it was actually read off a source, never the day a record was
 * edited.
 */
export function latestObservationDate(posts: Post[]): string | null {
  const dates = posts
    .filter(isVerifiedRecord)
    .map((post) => latestObservation(post).observed_at);
  return maxDate(dates);
}

/**
 * The single "when did this dataset last change" date the footer,
 * `/methodology` and the sitemap use: the latest of `latestObservationDate`
 * and every `verified_at` on a verified, non-placeholder record across all
 * three files. A record being verified counts as an update even on a day no
 * post was re-observed, and a fresh observation counts even on a day
 * nothing was newly verified — so this is always the later of the two.
 */
export function dataLastUpdated(
  posts: Post[],
  amplifications: Amplification[],
  media: MediaReference[],
): string | null {
  const dates = [
    latestObservationDate(posts),
    ...verifiedAtDates(posts),
    ...verifiedAtDates(amplifications),
    ...verifiedAtDates(media),
  ];
  return maxDate(dates);
}

type VerifiableWithVerifiedAt = {
  status: string;
  _placeholder?: boolean;
  verified_at: string | null;
};

function verifiedAtDates<T extends VerifiableWithVerifiedAt>(records: T[]): string[] {
  return records
    .filter(isVerifiedRecord)
    .map((record) => record.verified_at)
    .filter((value): value is string => value !== null);
}

/** Latest of a list of ISO dates/timestamps, truncated to `YYYY-MM-DD`; `null` for an empty list. */
function maxDate(dates: Array<string | null>): string | null {
  const values = dates.filter((value): value is string => value !== null);
  if (values.length === 0) return null;
  const latest = values.reduce((a, b) => (b > a ? b : a));
  return latest.slice(0, 10);
}
