import type { Post } from "@/schemas/post.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { compareArchiveOrder } from "@/lib/metrics/archive";
import { latestObservation } from "@/lib/metrics/observation";

const ONE_MILLION = 1_000_000;
const FIVE_MILLION = 5_000_000;
const TEN_MILLION = 10_000_000;

export interface TopPost {
  post: Post;
  views: number;
  url: string;
  observedAt: string;
}

export interface AttentionMetrics {
  trackedPostCount: number;
  postsOver1M: number;
  postsOver5M: number;
  postsOver10M: number;
  totalObservedViews: number;
  topPost: TopPost | null;
}

/**
 * docs/DATA.md §10 — Attention metrics, computed from eligible posts only
 * (`status === "verified" && _placeholder !== true`). Thresholds are inclusive (`>=`).
 *
 * Every figure here reads **one** observation per post — the latest, via
 * `latestObservation` (B18). That single rule is what keeps the headline
 * numbers meaning the same thing they meant before the history existed: a
 * sum across posts of one agreed reading each, never a mix of readings from
 * different days of the same post.
 */
export function getAttentionMetrics(posts: Post[]): AttentionMetrics {
  const eligible = posts.filter(isVerifiedRecord);

  const totalObservedViews = eligible.reduce(
    (sum, post) => sum + latestObservation(post).views,
    0,
  );

  // Tie-break shared with the archive sort (src/lib/metrics/archive.ts) — deliberately
  // the same comparator, so "the top post" and archive row 01 are provably one record.
  const topPost = eligible.reduce<Post | null>((best, candidate) => {
    if (best === null) return candidate;
    return compareArchiveOrder(candidate, best) < 0 ? candidate : best;
  }, null);

  return {
    trackedPostCount: eligible.length,
    postsOver1M: eligible.filter((post) => latestObservation(post).views >= ONE_MILLION).length,
    postsOver5M: eligible.filter((post) => latestObservation(post).views >= FIVE_MILLION).length,
    postsOver10M: eligible.filter((post) => latestObservation(post).views >= TEN_MILLION).length,
    totalObservedViews,
    topPost:
      topPost === null
        ? null
        : {
            post: topPost,
            views: latestObservation(topPost).views,
            url: topPost.url,
            // Still the observation's own date, never the post's
            // `published_at` — docs/ENGINEERING.md §7.
            observedAt: latestObservation(topPost).observed_at,
          },
  };
}
