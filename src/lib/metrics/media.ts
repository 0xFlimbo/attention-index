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
