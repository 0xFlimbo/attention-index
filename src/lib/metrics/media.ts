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
  /**
   * docs/DATA.md §10 — the provenance split of `verifiedMediaReferenceCount`.
   * `original` + `syndicated` always equals the total: every verified record
   * carries a provenance (enforced in `src/schemas/media.schema.ts`), so no
   * record can fall between the two.
   */
  originalReferenceCount: number;
  syndicatedReferenceCount: number;
  /** Verified records flagged by the /methodology featured criterion. */
  featuredReferenceCount: number;
  /**
   * Publication newsrooms by country, over **original** references only
   * (docs/DATA.md §10). A republication carries its republisher's country,
   * not the reporting's, so counting it would put a country on the map that
   * never reported anything. Records with `country: null` are counted
   * nowhere — an unknown newsroom country is not a country.
   */
  referencesByCountry: Record<string, number>;
  countryCount: number;
}

/** True for an eligible record that is the publication's own reporting. */
function isOriginalReference(reference: MediaReference): boolean {
  return reference.provenance === "original";
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
 *
 * **The B13 counting rule.** Two different questions are kept apart rather
 * than averaged into one number:
 *   - *how many public records are there* — `verifiedMediaReferenceCount`,
 *     `uniquePublicationCount` and `referencesByPublication` count every
 *     eligible record, including republications. A republication is a real
 *     page a real outlet published, and hiding it from its own publication's
 *     count would make the count disagree with the rows underneath it.
 *   - *how much reporting is there* — `originalReferenceCount` and
 *     `referencesByCountry` count original records only. `IBTimes UK` plus
 *     `Inkl` is one piece of reporting and its republications, so any figure
 *     presented as coverage has to exclude the copies or it inflates
 *     (docs/WORKPLAN.md B13).
 * Neither figure is ever given the other's label; `/methodology` prints both
 * and says which is which.
 */
export function getMediaMetrics(mediaReferences: MediaReference[]): MediaMetrics {
  const eligible = mediaReferences.filter(isVerifiedRecord);

  const referencesByPublication: Record<string, number> = {};
  const referencesByType = emptyTypeCounts();
  const referencesByCountry: Record<string, number> = {};
  let originalReferenceCount = 0;
  let featuredReferenceCount = 0;

  for (const reference of eligible) {
    referencesByPublication[reference.publication] =
      (referencesByPublication[reference.publication] ?? 0) + 1;
    referencesByType[reference.reference_type] += 1;
    if (reference.featured) featuredReferenceCount += 1;
    if (!isOriginalReference(reference)) continue;
    originalReferenceCount += 1;
    if (reference.country !== null) {
      referencesByCountry[reference.country] = (referencesByCountry[reference.country] ?? 0) + 1;
    }
  }

  return {
    verifiedMediaReferenceCount: eligible.length,
    uniquePublicationCount: Object.keys(referencesByPublication).length,
    referencesByPublication,
    referencesByType,
    originalReferenceCount,
    syndicatedReferenceCount: eligible.length - originalReferenceCount,
    featuredReferenceCount,
    referencesByCountry,
    countryCount: Object.keys(referencesByCountry).length,
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
  /**
   * Derived counts for this publication's own group, exposed so the row can
   * state a fact about the group without recomputing it and so the ordering
   * keys below are testable. `references.length` stays the number the row
   * prints — it is the number of entries the reader can open in the panel.
   */
  originalCount: number;
  featuredCount: number;
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
 * (never relying on JS sort stability or object key order). Every key is a
 * fact stored on the records, never a computed rank (docs/WORKPLAN.md B13):
 *   1. **original** reference count, descending — a publication that did its
 *      own reporting leads one that republished someone else's, which is the
 *      whole provenance distinction expressed as position;
 *   2. featured reference count, descending — the declared curation
 *      criterion published on `/methodology`, and the only place it acts;
 *   3. total reference count, descending;
 *   4. most recent `published_at` among the group's own references,
 *      descending (a tied publication with fresher coverage leads);
 *   5. `publication`, ascending, lexicographic (final deterministic
 *      tie-break when all of the above are equal).
 * Each group's own references are sorted with the existing
 * `compareMediaOrder`, so the newest reference is also what "most recent
 * published_at" reads from step 4.
 *
 * Why original count outranks featured, and not the reverse: the row prints
 * its total reference count, and `featured` is invisible to the reader, so a
 * list ordered featured-first would print 3, 1, 1, 3, 2 down the right rail
 * and read as broken rather than as curated. Ordering still carries the
 * prominence B13 asked for — every featured publication leads the
 * unfeatured ones it ties with, and the one publication that only
 * republished sits last. Reversible without touching anything else.
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
    ([publication, references]) => {
      const sorted = references.slice().sort(compareMediaOrder);
      return {
        publication,
        references: sorted,
        originalCount: sorted.filter(isOriginalReference).length,
        featuredCount: sorted.filter((reference) => reference.featured).length,
      };
    },
  );

  groups.sort((a, b) => {
    if (a.originalCount !== b.originalCount) return b.originalCount - a.originalCount;
    if (a.featuredCount !== b.featuredCount) return b.featuredCount - a.featuredCount;
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
