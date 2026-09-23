import {
  mediaCitedWorkEnum,
  mediaReferenceTypeEnum,
  type MediaCitedWork,
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
  /**
   * docs/DATA.md §10 — which of the project's works the reporting cited, over
   * **original** references only, for the same reason `referencesByCountry`
   * is: a republication carries the original's cited work, so counting it
   * would report one newsroom's use of a dataset as two. The name says so,
   * because this is the one map in this object that does not count every
   * eligible record and a caller should not have to read the comment to find
   * that out.
   *
   * Every member of the enum is a key, `"none"` included, so the split is
   * complete over `originalReferenceCount` and can never be read as a count
   * of records that cite *something*: the keys sum to the original count
   * exactly, and the schema requires a value on every verified record.
   */
  originalReferencesByCitedWork: Record<MediaCitedWork, number>;
}

/** True for an eligible record that is the publication's own reporting. */
function isOriginalReference(reference: MediaReference): boolean {
  return reference.provenance === "original";
}

function emptyCitedWorkCounts(): Record<MediaCitedWork, number> {
  return Object.fromEntries(
    mediaCitedWorkEnum.options.map((work) => [work, 0]),
  ) as Record<MediaCitedWork, number>;
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
 * **The counting rule (docs/DATA.md §10).** Two different questions are kept apart rather
 * than averaged into one number:
 *   - *how many public records are there* — `verifiedMediaReferenceCount`,
 *     `uniquePublicationCount` and `referencesByPublication` count every
 *     eligible record, including republications. A republication is a real
 *     page a real outlet published, and hiding it from its own publication's
 *     count would make the count disagree with the rows underneath it.
 *   - *how much reporting is there* — `originalReferenceCount`,
 *     `referencesByCountry` and `originalReferencesByCitedWork` count
 *     original records only (`cited_work`, docs/DATA.md §7). `IBTimes UK` plus
 *     `Inkl` is one piece of reporting and its republications, so any figure
 *     presented as coverage has to exclude the copies or it inflates it.
 * Neither figure is ever given the other's label; `/methodology` prints both
 * and says which is which.
 */
export function getMediaMetrics(mediaReferences: MediaReference[]): MediaMetrics {
  const eligible = mediaReferences.filter(isVerifiedRecord);

  const referencesByPublication: Record<string, number> = {};
  const referencesByType = emptyTypeCounts();
  const referencesByCountry: Record<string, number> = {};
  const originalReferencesByCitedWork = emptyCitedWorkCounts();
  let originalReferenceCount = 0;
  let featuredReferenceCount = 0;

  for (const reference of eligible) {
    referencesByPublication[reference.publication] =
      (referencesByPublication[reference.publication] ?? 0) + 1;
    referencesByType[reference.reference_type] += 1;
    if (reference.featured) featuredReferenceCount += 1;
    if (!isOriginalReference(reference)) continue;
    originalReferenceCount += 1;
    // Non-null on every eligible record by schema, so no bucket is skipped.
    if (reference.cited_work !== null) originalReferencesByCitedWork[reference.cited_work] += 1;
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
    originalReferencesByCitedWork,
  };
}

/**
 * Deterministic media ordering for `/evidence`: newest `published_at`
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
 * fact stored on the records, never a computed rank (docs/DATA.md §11):
 *   1. **total** reference count, descending — the number the row actually
 *      prints, so the right rail always descends;
 *   2. original reference count, descending — a publication that did its own
 *      reporting leads one that republished someone else's, which is the
 *      whole provenance distinction expressed as position;
 *   3. featured reference count, descending — the declared curation
 *      criterion published on `/methodology`, and the only place it acts;
 *   4. most recent `published_at` among the group's own references,
 *      descending (a tied publication with fresher coverage leads);
 *   5. `publication`, ascending, lexicographic (final deterministic
 *      tie-break when all of the above are equal).
 * Each group's own references are sorted with the existing
 * `compareMediaOrder`, so the newest reference is also what "most recent
 * published_at" reads from step 4.
 *
 * Why the printed count outranks both provenance and featured
 * (docs/DATA.md §11). The original rule was that an invisible key must not
 * reorder a visible number: it demoted `featured` below the original count
 * because "a list ordered featured-first would print 3, 1, 1, 3, 2 down the
 * right rail and read as broken rather than as curated". The original count
 * is just as invisible to the reader as `featured` is, so the same rule
 * applies to it one key higher up — which only became observable once
 * the section grew from 12 rows to 51. At that size the provenance key put
 * `Inkl` (8 references, 0 originals) at row 43, below thirty-odd rows
 * printing `1 reference`, and `Alex Jones Live` (3 references, 2 originals)
 * below `The National Pulse` (2 references) in the first screenful at 390px.
 * Both are the keys doing exactly what they were written to do, and both
 * read as a broken sort. Prominence still does its work, inside the ties the
 * printed number creates: among publications with the same reference count,
 * the one that reported leads the one that republished, and a featured
 * publication leads the unfeatured ones it ties with.
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
    if (a.references.length !== b.references.length) return b.references.length - a.references.length;
    if (a.originalCount !== b.originalCount) return b.originalCount - a.originalCount;
    if (a.featuredCount !== b.featuredCount) return b.featuredCount - a.featuredCount;

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

/**
 * docs/HOMEPAGE.md §11 — the homepage Public References section shows the
 * first N groups of `selectPublicationReferences`; `/evidence` lists every
 * verified record, and the section's own `OPEN EVIDENCE →` link is how a
 * reader reaches the rest. The counterpart of
 * `HOMEPAGE_ARCHIVE_ROW_COUNT` (src/lib/metrics/archive.ts), and chosen the
 * same way: the homepage shows a readable head of a list whose full form
 * lives on its own route.
 *
 * Twelve, because twelve rows is the composition this section was reviewed
 * at and approved early on — the dataset behind it later grew from 12
 * publications to 51, which is a reason to cap the section, not a reason to
 * resize it. It is a constant, not a threshold: it is deliberately not
 * "however many publications have more than one reference" (eleven, today),
 * because that is a property of this week's dataset and would silently
 * change the section's height every time a record is added. If the dataset
 * holds fewer groups than this, the section shows what exists — no padding.
 */
export const HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT = 12;
