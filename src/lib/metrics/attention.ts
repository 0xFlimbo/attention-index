import type { Post } from "@/schemas/post.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";

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

  const topPost = eligible.reduce<Post | null>((best, candidate) => {
    if (best === null) return candidate;
    return compareForTopPost(candidate, best) < 0 ? candidate : best;
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

/**
 * Deterministic top-post tie-break: highest views → earliest `published_at` → smallest
 * `id` (lexicographic). Required because real data can genuinely tie on views — two
 * tracked posts currently sit at 4,500,000 observed views each — and without an explicit
 * rule "the top post" would depend on array order and could change silently between
 * builds even though nothing in the underlying data changed.
 */
function compareForTopPost(a: Post, b: Post): number {
  if (a.metrics.views !== b.metrics.views) return b.metrics.views - a.metrics.views;
  if (a.published_at !== b.published_at) return a.published_at < b.published_at ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
