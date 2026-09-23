import { describe, expect, it } from "vitest";
import { postSchema, postsFileSchema, type Post, type PostObservation } from "../src/schemas/post.schema";
import frozenPostsJson from "./fixtures/dataset-2026-09-20/posts.json";
import { latestObservation } from "../src/lib/metrics/observation";
import { getAttentionMetrics } from "../src/lib/metrics/attention";
import { compareArchiveOrder } from "../src/lib/metrics/archive";
import { getPosts } from "../src/lib/data/posts";

/**
 * docs/WORKPLAN.md B18 — the append-only observation history. Covers the
 * schema rules that keep "the latest observation" well defined, the selector
 * every derived metric now goes through, and the mixed-precision case the
 * batch exists to handle.
 */

function makeObservation(overrides: Partial<PostObservation> = {}): PostObservation {
  return {
    views: 1_000_000,
    likes: null,
    reposts: null,
    replies: null,
    bookmarks: null,
    observed_at: "2026-01-02",
    source: "interface",
    ...overrides,
  };
}

function validPost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-example-1",
    platform: "x",
    account: "@LayoffAI",
    published_at: "2026-01-01",
    title: "Example post",
    subject: null,
    summary: null,
    url: "https://x.com/LayoffAI/status/1",
    status: "verified",
    featured: false,
    tags: [],
    observations: [makeObservation()],
    screenshot: null,
    notes: null,
    verified_at: "2026-01-02",
    ...overrides,
  };
}

function makePost(overrides: Partial<Post> & { id: string }): Post {
  return {
    platform: "x",
    account: "@LayoffAI",
    published_at: "2026-01-01",
    title: "Test post",
    subject: null,
    summary: null,
    url: "https://x.com/LayoffAI/status/1",
    status: "verified",
    featured: false,
    tags: [],
    observations: [makeObservation()],
    screenshot: null,
    notes: null,
    verified_at: "2026-01-02",
    ...overrides,
  };
}

describe("postSchema — the observation history", () => {
  it("rejects a post with no observations at all", () => {
    expect(postSchema.safeParse(validPost({ observations: [] })).success).toBe(false);
  });

  it("rejects an observation with no date", () => {
    const observation = { ...makeObservation() } as Record<string, unknown>;
    delete observation["observed_at"];
    expect(postSchema.safeParse(validPost({ observations: [observation] })).success).toBe(false);
  });

  it("rejects an observation with no source", () => {
    const observation = { ...makeObservation() } as Record<string, unknown>;
    delete observation["source"];
    expect(postSchema.safeParse(validPost({ observations: [observation] })).success).toBe(false);
  });

  it("rejects two observations on the same day — the latest must be one record", () => {
    const result = postSchema.safeParse(
      validPost({
        observations: [
          makeObservation({ observed_at: "2026-01-02", views: 1 }),
          makeObservation({ observed_at: "2026-01-02", views: 2 }),
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a history stored newest-first", () => {
    const result = postSchema.safeParse(
      validPost({
        observations: [
          makeObservation({ observed_at: "2026-03-01" }),
          makeObservation({ observed_at: "2026-01-02" }),
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a chronological, mixed-source history", () => {
    const result = postSchema.safeParse(
      validPost({
        observations: [
          makeObservation({ observed_at: "2026-01-02", views: 427_443, source: "api" }),
          makeObservation({ observed_at: "2026-03-01", views: 427_000, source: "interface" }),
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("separates same-day readings when they carry a full timestamp", () => {
    const result = postSchema.safeParse(
      validPost({
        observations: [
          makeObservation({ observed_at: "2026-01-02T08:00:00Z" }),
          makeObservation({ observed_at: "2026-01-02T20:00:00Z" }),
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("latestObservation", () => {
  it("returns the only observation when there is one", () => {
    const post = makePost({ id: "post-a" });
    expect(latestObservation(post).views).toBe(1_000_000);
  });

  it("returns the most recent by date, not the last in the array", () => {
    // Deliberately out of the order the schema enforces: the selector must not
    // depend on file order, so a broken file is a validation failure rather
    // than a wrong headline number.
    const post = makePost({
      id: "post-a",
      observations: [
        makeObservation({ observed_at: "2026-05-01", views: 500 }),
        makeObservation({ observed_at: "2026-01-01", views: 100 }),
      ],
    });
    expect(latestObservation(post).views).toBe(500);
  });

  it("does not prefer an API reading over a more recent interface reading", () => {
    // The B18 trap, on the real numbers: 427,443 read from the API, then
    // 427,000 read off the interface two days later. The published figure is
    // the later one — it is not a decline, it is a rounded reading of the same
    // counter, and it is paired with its own date.
    const post = makePost({
      id: "post-a",
      observations: [
        makeObservation({ observed_at: "2026-09-17", views: 427_443, source: "api" }),
        makeObservation({ observed_at: "2026-09-19", views: 427_000, source: "interface" }),
      ],
    });
    expect(latestObservation(post)).toMatchObject({ views: 427_000, source: "interface" });
  });

  it("keeps the earlier reading retrievable — a refresh appends, never replaces", () => {
    const post = makePost({
      id: "post-a",
      observations: [
        makeObservation({ observed_at: "2026-09-17", views: 427_443, source: "api" }),
        makeObservation({ observed_at: "2026-09-19", views: 427_000, source: "interface" }),
      ],
    });
    expect(post.observations).toHaveLength(2);
    expect(post.observations.map((observation) => observation.source)).toEqual([
      "api",
      "interface",
    ]);
  });
});

describe("derived metrics read exactly one observation per post", () => {
  const post = makePost({
    id: "post-a",
    observations: [
      makeObservation({ observed_at: "2026-01-01", views: 200_000 }),
      makeObservation({ observed_at: "2026-02-01", views: 1_500_000 }),
    ],
  });

  it("sums the latest reading, never every reading in the history", () => {
    const metrics = getAttentionMetrics([post]);
    // 1,500,000 — not 1,700,000, which is what summing the history would give.
    expect(metrics.totalObservedViews).toBe(1_500_000);
  });

  it("counts thresholds against the latest reading", () => {
    // The first observation is below 1M and the latest is above it.
    expect(getAttentionMetrics([post]).postsOver1M).toBe(1);
  });

  it("reports the top post's own observation date, not its publish date", () => {
    const metrics = getAttentionMetrics([post]);
    expect(metrics.topPost?.observedAt).toBe("2026-02-01");
    expect(metrics.topPost?.views).toBe(1_500_000);
  });

  it("orders the archive by the latest reading", () => {
    const older = makePost({
      id: "post-b",
      observations: [makeObservation({ observed_at: "2026-02-01", views: 900_000 })],
    });
    expect([older, post].slice().sort(compareArchiveOrder).map((entry) => entry.id)).toEqual([
      "post-a",
      "post-b",
    ]);
  });
});

describe("observation history — real dataset", () => {
  const posts = getPosts();

  it("gives every post at least one observation", () => {
    for (const post of posts) {
      expect(post.observations.length).toBeGreaterThan(0);
    }
  });

  /*
   * Append-only, checked against the file itself. The frozen fixture holds
   * every post's history as it stood on 2026-09-20; whatever has been
   * refreshed since, each of those histories must still begin with exactly
   * those readings. This is what `pnpm refresh:metrics` promises, and it is
   * the one assertion here a correct refresh can never break.
   */
  it("keeps every frozen reading at the head of its post's history — a refresh appends, never replaces", () => {
    const frozen = postsFileSchema.parse(frozenPostsJson);
    for (const frozenPost of frozen) {
      const live = posts.find((entry) => entry.id === frozenPost.id);
      expect(live, frozenPost.id).toBeDefined();
      expect(live!.observations.slice(0, frozenPost.observations.length)).toEqual(frozenPost.observations);
    }
  });

  it("still holds the one API reading the precision rule exists for", () => {
    const post = posts.find((entry) => entry.id === "post-layoffai-2086800985079562516");
    expect(post!.observations).toContainEqual({
      views: 427_443,
      likes: 5_510,
      reposts: 2_169,
      replies: 224,
      bookmarks: null,
      observed_at: "2026-09-17",
      source: "api",
    });
  });
});

describe("observation history — frozen fixture (2026-09-20)", () => {
  it("matches the migration's reading: 32 posts, 31 interface and 1 API", () => {
    const frozen = postsFileSchema.parse(frozenPostsJson);
    const sources = frozen.flatMap((post) => post.observations.map((o) => o.source));
    expect(frozen).toHaveLength(32);
    expect(sources.filter((source) => source === "interface")).toHaveLength(31);
    expect(sources.filter((source) => source === "api")).toHaveLength(1);
  });
});
