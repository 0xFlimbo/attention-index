import type { Post } from "@/schemas/post.schema";
import type { Amplification } from "@/schemas/amplification.schema";
import type { MediaReference } from "@/schemas/media.schema";
import type { Milestone } from "@/schemas/milestone.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";

/**
 * docs/HOMEPAGE.md §12 — one row of the Evidence section's dataset summary.
 * `count` is always derived from the eligible records passed in, never a
 * stored or hardcoded number (docs/CLAUDE.md §3). A zero-count row still
 * renders — "MILESTONES · 0 RECORDS" is an honest statement about today's
 * dataset — but `href` is `null` so `EvidenceBlock` never links to an
 * `/evidence` anchor that has nothing under it.
 */
export interface DatasetSummaryRow {
  key: "posts" | "amplifications" | "media" | "milestones";
  label: string;
  count: number;
  href: string | null;
}

export interface SelectDatasetSummaryInput {
  posts: Post[];
  amplifications: Amplification[];
  mediaReferences: MediaReference[];
  milestones: Milestone[];
}

/** Row order is fixed regardless of counts — docs/HOMEPAGE.md §12 lists them in this order. */
const ROW_DEFINITIONS: ReadonlyArray<{ key: DatasetSummaryRow["key"]; label: string }> = [
  { key: "posts", label: "POST DATA" },
  { key: "amplifications", label: "AMPLIFICATIONS" },
  { key: "media", label: "MEDIA" },
  { key: "milestones", label: "MILESTONES" },
];

/**
 * Pure selector, same shape as the other selectors in this directory: no
 * JSON imports here, the loaders own that. Each count reuses the shared
 * `isVerifiedRecord` eligibility rule — never `array.length`, never a
 * stored summary.
 */
export function selectDatasetSummary(input: SelectDatasetSummaryInput): DatasetSummaryRow[] {
  const counts: Record<DatasetSummaryRow["key"], number> = {
    posts: input.posts.filter(isVerifiedRecord).length,
    amplifications: input.amplifications.filter(isVerifiedRecord).length,
    media: input.mediaReferences.filter(isVerifiedRecord).length,
    milestones: input.milestones.filter(isVerifiedRecord).length,
  };

  return ROW_DEFINITIONS.map(({ key, label }) => {
    const count = counts[key];
    return {
      key,
      label,
      count,
      href: count === 0 ? null : `/evidence#${key}`,
    };
  });
}
