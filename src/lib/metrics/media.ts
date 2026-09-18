import {
  mediaReferenceTypeEnum,
  type MediaReference,
  type MediaReferenceType,
} from "@/schemas/media.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";

export interface MediaMetrics {
  verifiedMediaReferenceCount: number;
  uniquePublicationCount: number;
  referencesByPublication: Record<string, number>;
  referencesByType: Record<MediaReferenceType, number>;
}

function emptyTypeCounts(): Record<MediaReferenceType, number> {
  return Object.fromEntries(
    mediaReferenceTypeEnum.options.map((type) => [type, 0]),
  ) as Record<MediaReferenceType, number>;
}

/**
 * docs/DATA.md §10 — Media metrics, computed from eligible references only
 * (`status === "verified" && _placeholder !== true`). Publication totals are always
 * derived, never stored (docs/DATA.md §7).
 */
export function getMediaMetrics(mediaReferences: MediaReference[]): MediaMetrics {
  const eligible = mediaReferences.filter(isVerifiedRecord);

  const referencesByPublication: Record<string, number> = {};
  const referencesByType = emptyTypeCounts();

  for (const reference of eligible) {
    referencesByPublication[reference.publication] =
      (referencesByPublication[reference.publication] ?? 0) + 1;
    referencesByType[reference.reference_type] += 1;
  }

  return {
    verifiedMediaReferenceCount: eligible.length,
    uniquePublicationCount: Object.keys(referencesByPublication).length,
    referencesByPublication,
    referencesByType,
  };
}

/**
 * Deterministic media ordering for `/evidence` (B5): newest `published_at`
 * first, tie-broken by smallest `id` (lexicographic) — same reasoning as
 * `compareArchiveOrder` (src/lib/metrics/archive.ts) and
 * `compareAmplifierOrder` (src/lib/metrics/amplification.ts): nothing here
 * relies on JS's sort stability, so a genuine same-day tie still sorts the
 * same way on every build.
 */
export function compareMediaOrder(a: MediaReference, b: MediaReference): number {
  if (a.published_at !== b.published_at) return a.published_at > b.published_at ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * docs/ENGINEERING.md §6 — the verified, sorted media list `/evidence`
 * renders directly. No filters, no pagination — the whole eligible set,
 * ordered by `compareMediaOrder`.
 */
export function selectMediaReferences(mediaReferences: MediaReference[]): MediaReference[] {
  return mediaReferences.filter(isVerifiedRecord).slice().sort(compareMediaOrder);
}

/** One publication's eligible references, already sorted for display. */
export interface PublicationReferences {
  publication: string;
  references: MediaReference[];
}

/**
 * docs/HOMEPAGE.md §11 — Public References groups eligible media by
 * `publication` (grouped, not counted, in `getMediaMetrics`, which this
 * deliberately does not reuse or duplicate — that function stays the single
 * source for `/evidence`'s and the Evidence panel's aggregate counts; this
 * one carries the actual records each row needs to expand). Publication
 * names are grouped verbatim — docs/EDITORIAL.md §5: "Publication and
 * company names use their standard public form" — never normalized,
 * uppercased or rewritten here.
 *
 * Group order is deterministic, same tie-break philosophy as
 * `compareArchiveOrder` / `compareMediaOrder` / `compareAmplifierOrder`
 * (never relying on JS sort stability or object key order):
 *   1. reference count, descending (the publication with the most eligible
 *      references leads);
 *   2. most recent `published_at` among the group's own references,
 *      descending (a tied publication with fresher coverage leads);
 *   3. `publication`, ascending, lexicographic (final deterministic
 *      tie-break when both of the above are equal).
 * Each group's own references are sorted with the existing
 * `compareMediaOrder`, so the newest reference is also what "most recent
 * published_at" reads from step 2.
 */
export function selectPublicationReferences(mediaReferences: MediaReference[]): PublicationReferences[] {
  const eligible = mediaReferences.filter(isVerifiedRecord);

  const byPublication = new Map<string, MediaReference[]>();
  for (const reference of eligible) {
    const group = byPublication.get(reference.publication);
    if (group === undefined) {
      byPublication.set(reference.publication, [reference]);
    } else {
      group.push(reference);
    }
  }

  const groups: PublicationReferences[] = Array.from(byPublication.entries()).map(
    ([publication, references]) => ({
      publication,
      references: references.slice().sort(compareMediaOrder),
    }),
  );

  groups.sort((a, b) => {
    if (a.references.length !== b.references.length) return b.references.length - a.references.length;

    // `references` is already sorted newest-first (compareMediaOrder), so
    // index 0 is each group's most recent `published_at`.
    const aMostRecent = a.references[0]!.published_at;
    const bMostRecent = b.references[0]!.published_at;
    if (aMostRecent !== bMostRecent) return aMostRecent > bMostRecent ? -1 : 1;

    if (a.publication === b.publication) return 0;
    return a.publication < b.publication ? -1 : 1;
  });

  return groups;
}
