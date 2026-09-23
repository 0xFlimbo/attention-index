import { describe, expect, it } from "vitest";
import { getAttentionMetrics } from "../src/lib/metrics/attention";
import { selectAttentionGridCells } from "../src/lib/metrics/attention-grid";
import { getPosts } from "../src/lib/data/posts";
import { formatCompactNumber, formatCount } from "../src/lib/format/number";
import type { Post } from "../src/schemas/post.schema";
import livePostsJson from "../data/posts.json";

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
    observations: [
      {
        views,
        likes: null,
        reposts: null,
        replies: null,
        bookmarks: null,
        observed_at: "2026-01-02",
        source: "interface",
      },
    ],
    screenshot: null,
    notes: null,
    verified_at: "2026-01-02",
    ...rest,
  };
}

/**
 * The live file is asserted by relationship, never by literal: a manual metric
 * refresh (`pnpm refresh:metrics`) moves every view count, and a test pinned to
 * last week's figure would fail on a correct refresh. The literal grid the
 * homepage was reviewed at — 17 / 32 / 4.5M / 43.6M — is still checked, against
 * the frozen fixture in `tests/frozen-dataset.test.ts` (docs/ENGINEERING.md §9).
 */
describe("selectAttentionGridCells — current dataset resolution", () => {
  it("resolves the real dataset to the cells its own figures call for, recomputed from the file", () => {
    // Recomputed from the JSON, independently of src/lib: verified, not a
    // placeholder, and the latest reading of each post.
    const views = (livePostsJson as unknown as Post[])
      .filter((post) => post.status === "verified" && post._placeholder !== true)
      .map((post) => post.observations.reduce((a, b) => (b.observed_at > a.observed_at ? b : a)).views);
    const above = (floor: number) => views.filter((count) => count >= floor).length;
    const thresholdLabels = (
      [
        ["POSTS ABOVE 1M", above(1_000_000)],
        ["POSTS ABOVE 5M", above(5_000_000)],
        ["POSTS ABOVE 10M", above(10_000_000)],
      ] as const
    )
      .filter(([, count]) => count > 0)
      .map(([label]) => label);
    const expectedLabels = [
      ...thresholdLabels,
      "TRACKED POSTS",
      "MOST VIEWED TRACKED POST",
      "OBSERVED VIEWS ACROSS TRACKED POSTS",
    ].slice(0, 4);

    const cells = selectAttentionGridCells(getAttentionMetrics(getPosts()));
    const value = (label: string) => cells.find((cell) => cell.label === label)?.value;

    expect(cells.map((cell) => cell.label)).toEqual(expectedLabels);
    expect(value("TRACKED POSTS")).toBe(formatCount(views.length));
    if (thresholdLabels.includes("POSTS ABOVE 1M")) {
      expect(value("POSTS ABOVE 1M")).toBe(formatCount(above(1_000_000)));
    }
    if (expectedLabels.includes("MOST VIEWED TRACKED POST")) {
      expect(value("MOST VIEWED TRACKED POST")).toBe(formatCompactNumber(Math.max(...views)));
    }
    if (expectedLabels.includes("OBSERVED VIEWS ACROSS TRACKED POSTS")) {
      expect(value("OBSERVED VIEWS ACROSS TRACKED POSTS")).toBe(
        formatCompactNumber(views.reduce((sum, count) => sum + count, 0)),
      );
    }

    // MOST VIEWED TRACKED POST is the only cell tied to one record — it carries
    // a source link and an observation date; the aggregate cells carry neither.
    for (const cell of cells) {
      const tiedToOneRecord = cell.label === "MOST VIEWED TRACKED POST";
      expect(cell.sourceUrl === null).toBe(!tiedToOneRecord);
      expect(cell.observedAt === null).toBe(!tiedToOneRecord);
    }
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
