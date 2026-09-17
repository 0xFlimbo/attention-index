import { describe, expect, it } from "vitest";
import {
  compareArchiveOrder,
  selectArchivePosts,
  selectArchiveThresholds,
  HOMEPAGE_ARCHIVE_ROW_COUNT,
} from "../src/lib/metrics/archive";
import { getAttentionMetrics } from "../src/lib/metrics/attention";
import { getPosts } from "../src/lib/data/posts";
import type { Post } from "../src/schemas/post.schema";

function makePost(overrides: Partial<Post> & { id: string; views: number }): Post {
  const { views, ...rest } = overrides;
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
    metrics: {
      views,
      likes: null,
      reposts: null,
      replies: null,
      bookmarks: null,
      observed_at: "2026-01-02",
    },
    screenshot: null,
    notes: null,
    verified_at: "2026-01-02",
    ...rest,
  };
}

describe("selectArchivePosts — sort order", () => {
  it("sorts views descending, deterministically breaking the 4.5M tie by earliest published_at then smallest id", () => {
    const posts = [
      makePost({ id: "post-late", views: 4_500_000, published_at: "2026-09-13" }),
      makePost({ id: "post-early", views: 4_500_000, published_at: "2026-06-07" }),
      makePost({ id: "post-mid", views: 2_000_000, published_at: "2026-05-01" }),
    ];
    const archive = selectArchivePosts(posts);
    expect(archive.map((row) => row.post.id)).toEqual(["post-early", "post-late", "post-mid"]);
  });

  it("is the exact same comparator used for the top-post tie-break", () => {
    const posts = [
      makePost({ id: "post-b", views: 3_000_000, published_at: "2026-05-01" }),
      makePost({ id: "post-a", views: 3_000_000, published_at: "2026-05-01" }),
    ];
    expect(compareArchiveOrder(posts[0]!, posts[1]!)).toBeGreaterThan(0);
    expect(selectArchivePosts(posts)[0]?.post.id).toBe("post-a");
  });

  it("archive row 01 is provably the same post getAttentionMetrics calls the top post", () => {
    const realPosts = getPosts();
    const archive = selectArchivePosts(realPosts);
    const metrics = getAttentionMetrics(realPosts);
    expect(archive[0]?.post.id).toBe(metrics.topPost?.post.id);
  });
});

describe("selectArchivePosts — eligibility", () => {
  it("excludes needs_review, archived and _placeholder records", () => {
    const posts = [
      makePost({ id: "post-verified", views: 2_000_000 }),
      makePost({ id: "post-archived", views: 9_000_000, status: "archived" }),
      makePost({ id: "post-needs-review", views: 9_000_000, status: "needs_review" }),
      makePost({
        id: "post-placeholder",
        views: 9_000_000,
        status: "needs_review",
        _placeholder: true,
      }),
    ];
    const archive = selectArchivePosts(posts);
    expect(archive).toHaveLength(1);
    expect(archive[0]?.post.id).toBe("post-verified");
  });

  it("returns an empty list for an empty dataset", () => {
    expect(selectArchivePosts([])).toEqual([]);
  });
});

describe("selectArchivePosts — stable rank", () => {
  it("assigns 1-based ranks over the full sorted list", () => {
    const posts = [
      makePost({ id: "post-a", views: 1_000_000 }),
      makePost({ id: "post-b", views: 5_000_000 }),
      makePost({ id: "post-c", views: 2_000_000 }),
    ];
    const archive = selectArchivePosts(posts);
    expect(archive.map((row) => [row.post.id, row.rank])).toEqual([
      ["post-b", 1],
      ["post-c", 2],
      ["post-a", 3],
    ]);
  });

  it("rank does not renumber when the caller filters the result afterwards — 01 always means the same post", () => {
    const posts = [
      makePost({ id: "post-a", views: 1_200_000 }),
      makePost({ id: "post-b", views: 5_000_000 }),
      makePost({ id: "post-c", views: 900_000 }),
    ];
    const archive = selectArchivePosts(posts);
    const over1M = archive.filter((row) => row.post.metrics.views >= 1_000_000);
    // post-b keeps rank 1 and post-a keeps rank 2 even though post-c (rank 3) was filtered out.
    expect(over1M.map((row) => row.rank)).toEqual([1, 2]);
  });
});

describe("selectArchiveThresholds", () => {
  it("only offers ALL when no post crosses 1M", () => {
    const posts = [makePost({ id: "post-a", views: 400_000 })];
    const thresholds = selectArchiveThresholds(posts);
    expect(thresholds.map((option) => option.id)).toEqual(["all"]);
    expect(thresholds[0]?.count).toBe(1);
  });

  it("offers ALL and >1M but never >5M or >10M when the data doesn't support them (today's dataset shape)", () => {
    const posts = [
      makePost({ id: "post-a", views: 4_500_000 }),
      makePost({ id: "post-b", views: 1_200_000 }),
      makePost({ id: "post-c", views: 900_000 }),
    ];
    const thresholds = selectArchiveThresholds(posts);
    expect(thresholds.map((option) => option.id)).toEqual(["all", "1m"]);
    expect(thresholds.find((option) => option.id === "1m")?.count).toBe(2);
  });

  it("offers >5M once at least one record qualifies", () => {
    const posts = [
      makePost({ id: "post-a", views: 6_000_000 }),
      makePost({ id: "post-b", views: 1_200_000 }),
    ];
    const thresholds = selectArchiveThresholds(posts);
    expect(thresholds.map((option) => option.id)).toEqual(["all", "1m", "5m"]);
    expect(thresholds.find((option) => option.id === "5m")?.count).toBe(1);
  });

  it("thresholds are inclusive (>=), matching docs/DATA.md §10", () => {
    const posts = [makePost({ id: "post-a", views: 1_000_000 })];
    const thresholds = selectArchiveThresholds(posts);
    expect(thresholds.map((option) => option.id)).toEqual(["all", "1m"]);
  });

  it("returns only ALL, with a zero count, for an empty dataset", () => {
    const thresholds = selectArchiveThresholds([]);
    expect(thresholds).toEqual([{ id: "all", label: "ALL", minViews: null, count: 0 }]);
  });

  it("matches the real dataset: ALL and >1M only, >5M and >10M absent", () => {
    const thresholds = selectArchiveThresholds(getPosts());
    expect(thresholds.map((option) => option.id)).toEqual(["all", "1m"]);
  });
});

describe("HOMEPAGE_ARCHIVE_ROW_COUNT", () => {
  it("the homepage subset is exactly the N highest-view eligible posts, in order", () => {
    const realPosts = getPosts();
    const archive = selectArchivePosts(realPosts);
    const homepageSubset = archive.slice(0, HOMEPAGE_ARCHIVE_ROW_COUNT);

    // Independently derived: the N largest view counts among eligible posts,
    // descending — compared against the selector's own output rather than
    // against another slice of itself.
    const expectedViews = realPosts
      .filter((post) => post.status === "verified" && post._placeholder !== true)
      .map((post) => post.metrics.views)
      .sort((a, b) => b - a)
      .slice(0, HOMEPAGE_ARCHIVE_ROW_COUNT);
    expect(homepageSubset.map((row) => row.post.metrics.views)).toEqual(expectedViews);

    expect(homepageSubset.map((row) => row.rank)).toEqual(
      Array.from({ length: Math.min(HOMEPAGE_ARCHIVE_ROW_COUNT, archive.length) }, (_, i) => i + 1),
    );
  });

  it("shows fewer than N rows honestly when the dataset is smaller than N", () => {
    const posts = [makePost({ id: "post-a", views: 1_000_000 })];
    const archive = selectArchivePosts(posts);
    expect(archive.slice(0, HOMEPAGE_ARCHIVE_ROW_COUNT)).toHaveLength(1);
  });
});
