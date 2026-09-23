import type { Post } from "@/schemas/post.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { latestObservation } from "@/lib/metrics/observation";

/**
 * Deterministic archive ordering: highest views → earliest `published_at` →
 * smallest `id` (lexicographic). docs/DATA.md §11 sorts the archive by views
 * descending; this is the tie-break that makes that order reproducible
 * between builds even though nothing else in the data changed — real data
 * genuinely ties (until the first API refresh on 2026-09-23, two tracked
 * posts sat at 4,500,000 views each, both read off X's rounded interface).
 *
 * This is the single shared comparator for "the archive order" — used both
 * to sort the full archive and, in `getAttentionMetrics` (src/lib/metrics/
 * attention.ts), to pick the top post. That sharing is deliberate: it is
 * what guarantees archive row `01` is provably the same record the homepage
 * labels MOST VIEWED TRACKED POST, not just a coincidence of two separate
 * implementations agreeing today.
 */
export function compareArchiveOrder(a: Post, b: Post): number {
  // One agreed reading per post (docs/DATA.md §5): the comparator sorts on each post's
  // latest observation, the same value the row prints and the same one
  // `getAttentionMetrics` sums.
  const aViews = latestObservation(a).views;
  const bViews = latestObservation(b).views;
  if (aViews !== bViews) return bViews - aViews;
  if (a.published_at !== b.published_at) return a.published_at < b.published_at ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** One archive row's post plus its stable, 1-based rank in the full sorted list. */
export interface ArchivePost {
  post: Post;
  rank: number;
}

/**
 * docs/HOMEPAGE.md §10 / docs/DATA.md §11 — eligible posts (reusing the
 * shared `isVerifiedRecord` rule, never re-implemented here), sorted by
 * `compareArchiveOrder`, each carrying its stable rank. The rank is assigned
 * once over the *full* sorted list, before any threshold filter is applied,
 * so `01` always means "most viewed tracked post" regardless of which
 * filter is active — filtering must only hide rows, never renumber them.
 */
export function selectArchivePosts(posts: Post[]): ArchivePost[] {
  return posts
    .filter(isVerifiedRecord)
    .slice()
    .sort(compareArchiveOrder)
    .map((post, index) => ({ post, rank: index + 1 }));
}

/**
 * docs/HOMEPAGE.md §10 — the homepage section shows "the strongest rows":
 * the first N of the sorted archive. If the dataset is smaller than this,
 * the homepage simply shows what exists (no padding, no fabricated rows).
 */
export const HOMEPAGE_ARCHIVE_ROW_COUNT = 6;

export type ArchiveThresholdId = "all" | "1m" | "5m" | "10m";

/**
 * One archive filter option, carrying its own record count so the UI can
 * show it (and so `selectArchiveThresholds` can decide whether the option
 * is offered at all).
 */
export interface ArchiveThresholdOption {
  id: ArchiveThresholdId;
  /** EDITORIAL §9 — exact approved label text: `ALL`, `>1M`, `>5M`, `>10M`. Never invented names. */
  label: string;
  /** `null` for `ALL`; otherwise the inclusive (`>=`) view-count floor, matching docs/DATA.md §10. */
  minViews: number | null;
  count: number;
}

const THRESHOLD_DEFINITIONS: ReadonlyArray<{
  id: ArchiveThresholdId;
  label: string;
  minViews: number | null;
}> = [
  { id: "all", label: "ALL", minViews: null },
  { id: "1m", label: ">1M", minViews: 1_000_000 },
  { id: "5m", label: ">5M", minViews: 5_000_000 },
  { id: "10m", label: ">10M", minViews: 10_000_000 },
];

/**
 * docs/HOMEPAGE.md §10 — "only thresholds that match real records." `ALL`
 * is always offered (even for zero eligible posts, so the UI has something
 * to render); every other threshold is offered only when at least one
 * eligible post meets it (inclusive, `>=`, matching docs/DATA.md §10). On
 * 2026-09-23 (max views 4,585,209) this yielded `ALL` and `>1M` only — `>5M` and
 * `>10M` had zero records and did not appear, entirely because the data
 * didn't support them, never a hardcoded list of "current" thresholds.
 */
export function selectArchiveThresholds(posts: Post[]): ArchiveThresholdOption[] {
  const eligible = posts.filter(isVerifiedRecord);

  return THRESHOLD_DEFINITIONS.filter(
    (definition) => definition.minViews === null || countAtLeast(eligible, definition.minViews) > 0,
  ).map((definition) => ({
    id: definition.id,
    label: definition.label,
    minViews: definition.minViews,
    count: definition.minViews === null ? eligible.length : countAtLeast(eligible, definition.minViews),
  }));
}

function countAtLeast(posts: Post[], minViews: number): number {
  return posts.filter((post) => latestObservation(post).views >= minViews).length;
}
