import type { PostObservation } from "@/schemas/post.schema";

/**
 * docs/DATA.md §5 — how an API reading becomes an appended observation.
 *
 * Pure, so the whole refresh can be tested without a network or a disk. The
 * script (`scripts/refresh-post-metrics.ts`) only fetches, prints and writes;
 * every decision about what gets appended is made here.
 */

/** The `public_metrics` object of `GET /2/tweets?ids=`, as far as this reads it. */
export interface ApiPublicMetrics {
  impression_count?: number;
  like_count?: number;
  retweet_count?: number;
  quote_count?: number;
  reply_count?: number;
  bookmark_count?: number;
}

/** The fields of a stored post the refresh needs. Raw JSON, never the zod output. */
export interface RefreshablePost {
  id: string;
  url: string;
  observations: PostObservation[];
}

export type RefreshOutcome =
  | { postId: string; kind: "append"; observation: PostObservation; previous: PostObservation }
  | { postId: string; kind: "skip"; reason: string };

/** `https://x.com/<handle>/status/<id>` → `<id>`, or null for any other URL. */
export function statusIdFromUrl(url: string): string | null {
  return url.match(/\/status\/(\d+)/)?.[1] ?? null;
}

/**
 * One API reading, in the shape the history stores.
 *
 * **`reposts` is `retweet_count + quote_count`, and that is measured.** X's own
 * interface prints one "Reposts" figure that counts quotes too, and every
 * stored reading was taken from that figure. Against the paid reading of
 * 2026-09-21, the stored `reposts` sits closer to `retweet_count + quote_count`
 * than to `retweet_count` alone on 30 of the 32 posts, with a median gap of
 * 0.2%. The other two are interface readings X printed as `1.8K` and `1.4K`,
 * which it truncates, so they cannot tell the two apart. Mapping to
 * `retweet_count` would make every post look as if it lost its quotes on the
 * day of its first refresh.
 *
 * `views` is `impression_count`, the public counter X prints as views. A
 * reading with no `impression_count` is not a reading of views at all, so it
 * returns null rather than a zero.
 */
export function observationFromPublicMetrics(
  metrics: ApiPublicMetrics,
  observedAt: string,
): PostObservation | null {
  if (metrics.impression_count === undefined) return null;
  const reposts =
    metrics.retweet_count === undefined
      ? null
      : metrics.retweet_count + (metrics.quote_count ?? 0);
  return {
    views: metrics.impression_count,
    likes: metrics.like_count ?? null,
    reposts,
    replies: metrics.reply_count ?? null,
    bookmarks: metrics.bookmark_count ?? null,
    observed_at: observedAt,
    source: "api",
  };
}

/**
 * What a refresh would do to each post, decided before anything is written.
 *
 * It appends only a reading dated strictly after the post's latest one. The
 * schema already refuses a duplicate date and an out-of-order history; this
 * refuses them earlier and says why, so a re-run of the same reading is a
 * no-op rather than a validation failure.
 */
export function planObservationAppends(
  posts: RefreshablePost[],
  readings: ReadonlyMap<string, ApiPublicMetrics>,
  observedAt: string,
): RefreshOutcome[] {
  return posts.map((post): RefreshOutcome => {
    const statusId = statusIdFromUrl(post.url);
    if (!statusId) return { postId: post.id, kind: "skip", reason: "no status id in url" };

    const metrics = readings.get(statusId);
    if (!metrics) return { postId: post.id, kind: "skip", reason: "not in the reading" };

    const observation = observationFromPublicMetrics(metrics, observedAt);
    if (!observation) return { postId: post.id, kind: "skip", reason: "reading has no impression_count" };

    const previous = post.observations.reduce((latest, candidate) =>
      candidate.observed_at > latest.observed_at ? candidate : latest,
    );
    if (observedAt <= previous.observed_at) {
      return {
        postId: post.id,
        kind: "skip",
        reason: `already holds a reading on or after ${observedAt} (${previous.observed_at})`,
      };
    }
    return { postId: post.id, kind: "append", observation, previous };
  });
}

/**
 * The posts with each planned observation appended — a new array, the input
 * untouched. Every other field of every post is carried over as it was, so a
 * write changes nothing but the histories that grew.
 */
export function applyObservationAppends<T extends RefreshablePost>(
  posts: T[],
  outcomes: RefreshOutcome[],
): T[] {
  const appends = new Map<string, PostObservation>();
  for (const outcome of outcomes) {
    if (outcome.kind === "append") appends.set(outcome.postId, outcome.observation);
  }
  return posts.map((post) => {
    const observation = appends.get(post.id);
    return observation ? { ...post, observations: [...post.observations, observation] } : post;
  });
}
