import type { AttentionMetrics } from "./attention";
import { formatCompactNumber, formatCount } from "@/lib/format/number";

/**
 * docs/DATA.md §2 — platform enum values, rendered as short human-readable source
 * labels. Exported so other views tied to one specific post record (the archive rows
 * in src/components/archive-row.tsx) can reuse the same mapping rather than
 * redeclaring it.
 */
export const PLATFORM_LABELS: Record<string, string> = {
  x: "X",
  website: "Website",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  other: "Other",
};

/**
 * One resolved Attention Grid cell (docs/HOMEPAGE.md §6). `sourceUrl` and
 * `observedAt` are only set for a cell tied to one specific record (currently
 * only `MOST VIEWED TRACKED POST`) — aggregate cells (counts, sums across many
 * records with different observation dates) carry no single source or date.
 */
export interface AttentionGridCell {
  label: string;
  value: string;
  sourceUrl: string | null;
  sourcePlatformLabel: string | null;
  observedAt: string | null;
}

/**
 * docs/HOMEPAGE.md §6 — selects Attention Grid cells by data availability, in
 * priority order, skipping any threshold cell whose count is 0:
 *
 *   1. POSTS ABOVE 1M    (if count > 0)
 *   2. POSTS ABOVE 5M    (if count > 0)
 *   3. POSTS ABOVE 10M   (if count > 0)
 *   4. TRACKED POSTS     (always available)
 *   5. MOST VIEWED TRACKED POST (always available)
 *   6. OBSERVED VIEWS ACROSS TRACKED POSTS (always available)
 *
 * Returns at most four cells, taking the first four candidates in this order.
 * With today's dataset (>=1 threshold cell qualifies) this always yields
 * exactly four. If no threshold cell qualifies (no post crosses 1M views),
 * only the three "always available" cells exist and the function returns
 * three — StatGrid renders whatever it receives rather than fabricate a
 * fourth. This edge case does not occur with the current production dataset.
 */
export function selectAttentionGridCells(metrics: AttentionMetrics): AttentionGridCell[] {
  const candidates: AttentionGridCell[] = [];

  if (metrics.postsOver1M > 0) {
    candidates.push(countCell("POSTS ABOVE 1M", metrics.postsOver1M));
  }
  if (metrics.postsOver5M > 0) {
    candidates.push(countCell("POSTS ABOVE 5M", metrics.postsOver5M));
  }
  if (metrics.postsOver10M > 0) {
    candidates.push(countCell("POSTS ABOVE 10M", metrics.postsOver10M));
  }

  candidates.push(countCell("TRACKED POSTS", metrics.trackedPostCount));

  candidates.push(
    metrics.topPost === null
      ? {
          label: "MOST VIEWED TRACKED POST",
          value: "—",
          sourceUrl: null,
          sourcePlatformLabel: null,
          observedAt: null,
        }
      : {
          label: "MOST VIEWED TRACKED POST",
          value: formatCompactNumber(metrics.topPost.views),
          sourceUrl: metrics.topPost.url,
          sourcePlatformLabel: PLATFORM_LABELS[metrics.topPost.post.platform] ?? null,
          observedAt: metrics.topPost.observedAt,
        },
  );

  candidates.push({
    label: "OBSERVED VIEWS ACROSS TRACKED POSTS",
    value: formatCompactNumber(metrics.totalObservedViews),
    sourceUrl: null,
    sourcePlatformLabel: null,
    observedAt: null,
  });

  return candidates.slice(0, 4);
}

function countCell(label: string, count: number): AttentionGridCell {
  return {
    label,
    value: formatCount(count),
    sourceUrl: null,
    sourcePlatformLabel: null,
    observedAt: null,
  };
}
