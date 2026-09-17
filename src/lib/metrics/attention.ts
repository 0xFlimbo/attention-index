import type { Post } from "@/schemas/post.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { compareArchiveOrder } from "@/lib/metrics/archive";

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
 */
export function getAttentionMetrics(posts: Post[]): AttentionMetrics {
  const eligible = posts.filter(isVerifiedRecord);

  const totalObservedViews = eligible.reduce((sum, post) => sum + post.metrics.views, 0);

  // Tie-break shared with the archive sort (src/lib/metrics/archive.ts) — deliberately
  // the same comparator, so "the top post" and archive row 01 are provably one record.
  const topPost = eligible.reduce<Post | null>((best, candidate) => {
    if (best === null) return candidate;
    return compareArchiveOrder(candidate, best) < 0 ? candidate : best;
  }, null);

  return {
    trackedPostCount: eligible.length,
    postsOver1M: eligible.filter((post) => post.metrics.views >= ONE_MILLION).length,
    postsOver5M: eligible.filter((post) => post.metrics.views >= FIVE_MILLION).length,
    postsOver10M: eligible.filter((post) => post.metrics.views >= TEN_MILLION).length,
    totalObservedViews,
    topPost:
      topPost === null
        ? null
        : {
            post: topPost,
            views: topPost.metrics.views,
            url: topPost.url,
            observedAt: topPost.metrics.observed_at,
          },
  };
}
