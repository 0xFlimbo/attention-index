import { describe, expect, it } from "vitest";
import { getAttentionMetrics } from "../src/lib/metrics/attention";
import { selectAttentionGridCells } from "../src/lib/metrics/attention-grid";
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

describe("selectAttentionGridCells — current dataset resolution", () => {
  it("resolves to POSTS ABOVE 1M, TRACKED POSTS, MOST VIEWED TRACKED POST, OBSERVED VIEWS on the real dataset", () => {
    const metrics = getAttentionMetrics(getPosts());
    const cells = selectAttentionGridCells(metrics);

    expect(cells).toHaveLength(4);
    expect(cells.map((cell) => cell.label)).toEqual([
      "POSTS ABOVE 1M",
      "TRACKED POSTS",
      "MOST VIEWED TRACKED POST",
      "OBSERVED VIEWS ACROSS TRACKED POSTS",
    ]);
    expect(cells[0]?.value).toBe("17");
    expect(cells[1]?.value).toBe("21");
    expect(cells[2]?.value).toBe("4.5M");
    expect(cells[3]?.value).toBe("37.1M");

    // MOST VIEWED TRACKED POST is the only cell tied to one record — it carries
    // a source link and an observation date; the aggregate cells carry neither.
    expect(cells[2]?.sourceUrl).not.toBeNull();
    expect(cells[2]?.observedAt).not.toBeNull();
    expect(cells[0]?.sourceUrl).toBeNull();
    expect(cells[3]?.sourceUrl).toBeNull();
  });
});

describe("selectAttentionGridCells — 5M and 10M thresholds populated", () => {
  it("prioritizes all three threshold cells plus TRACKED POSTS, dropping MOST VIEWED and OBSERVED VIEWS", () => {
    const posts = [
      makePost({ id: "post-a", views: 12_000_000 }),
      makePost({ id: "post-b", views: 6_000_000 }),
      makePost({ id: "post-c", views: 1_500_000 }),
    ];
    const metrics = getAttentionMetrics(posts);
    const cells = selectAttentionGridCells(metrics);

    expect(cells).toHaveLength(4);
    expect(cells.map((cell) => cell.label)).toEqual([
      "POSTS ABOVE 1M",
      "POSTS ABOVE 5M",
      "POSTS ABOVE 10M",
      "TRACKED POSTS",
    ]);
    expect(cells[0]?.value).toBe("3");
    expect(cells[1]?.value).toBe("2");
    expect(cells[2]?.value).toBe("1");
    expect(cells[3]?.value).toBe("3");
  });
});

describe("selectAttentionGridCells — all thresholds at 0", () => {
  it("falls through to only the always-available cells (fewer than four is honest, not padded)", () => {
    const posts = [makePost({ id: "post-a", views: 400_000 })];
    const metrics = getAttentionMetrics(posts);
    const cells = selectAttentionGridCells(metrics);

    expect(cells.map((cell) => cell.label)).toEqual([
      "TRACKED POSTS",
      "MOST VIEWED TRACKED POST",
      "OBSERVED VIEWS ACROSS TRACKED POSTS",
    ]);
    expect(cells).toHaveLength(3);
  });

  it("never renders a threshold cell whose count is 0, even for an empty dataset", () => {
    const metrics = getAttentionMetrics([]);
    const cells = selectAttentionGridCells(metrics);

    expect(cells.some((cell) => cell.label.startsWith("POSTS ABOVE"))).toBe(false);
    expect(cells.map((cell) => cell.label)).toEqual([
      "TRACKED POSTS",
      "MOST VIEWED TRACKED POST",
      "OBSERVED VIEWS ACROSS TRACKED POSTS",
    ]);
    expect(cells[1]?.value).toBe("—");
    expect(cells[1]?.sourceUrl).toBeNull();
  });
});

describe("selectAttentionGridCells — exactly four invariant", () => {
  it("never returns more than four cells across representative datasets", () => {
    const datasets: Post[][] = [
      getPosts(),
      [makePost({ id: "post-a", views: 12_000_000 }), makePost({ id: "post-b", views: 6_000_000 })],
      [makePost({ id: "post-a", views: 400_000 })],
      [],
    ];
    for (const posts of datasets) {
      const cells = selectAttentionGridCells(getAttentionMetrics(posts));
      expect(cells.length).toBeLessThanOrEqual(4);
    }
  });

  it("returns exactly four cells whenever at least one threshold cell qualifies", () => {
    const posts = [makePost({ id: "post-a", views: 1_200_000 })];
    const cells = selectAttentionGridCells(getAttentionMetrics(posts));
    expect(cells).toHaveLength(4);
  });
});
