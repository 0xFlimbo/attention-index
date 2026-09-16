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
