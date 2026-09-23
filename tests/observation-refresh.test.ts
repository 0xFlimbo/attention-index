import { describe, expect, it } from "vitest";

import {
  applyObservationAppends,
  observationFromPublicMetrics,
  planObservationAppends,
  statusIdFromUrl,
  type ApiPublicMetrics,
  type RefreshablePost,
} from "../src/lib/metrics/observation-refresh";
import { postsFileSchema, type PostObservation } from "../src/schemas/post.schema";
import livePostsJson from "../data/posts.json";

const METRICS: ApiPublicMetrics = {
  impression_count: 427_781,
  like_count: 5_509,
  retweet_count: 2_007,
  quote_count: 156,
  reply_count: 223,
  bookmark_count: 1_407,
};

function reading(views: number, observedAt: string): PostObservation {
  return { views, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: observedAt, source: "interface" };
}

function post(id: string, statusId: string, ...observations: PostObservation[]): RefreshablePost {
  return { id, url: `https://x.com/LayoffAI/status/${statusId}`, observations };
}

describe("statusIdFromUrl", () => {
  it("reads the id off an x.com status URL", () => {
    expect(statusIdFromUrl("https://x.com/LayoffAI/status/2086800985079562516")).toBe("2086800985079562516");
  });

  it("returns null for a URL that is not a status", () => {
    expect(statusIdFromUrl("https://layoffhedge.com/company/meta")).toBeNull();
  });
});

describe("observationFromPublicMetrics", () => {
  it("maps each counter to its field, with source api and the reading's date", () => {
    expect(observationFromPublicMetrics(METRICS, "2026-09-21")).toEqual({
      views: 427_781,
      likes: 5_509,
      reposts: 2_163,
      replies: 223,
      bookmarks: 1_407,
      observed_at: "2026-09-21",
      source: "api",
    });
  });

  it("counts quotes in reposts, as X's own Reposts figure does", () => {
    const observation = observationFromPublicMetrics(METRICS, "2026-09-21");
    expect(observation?.reposts).toBe(METRICS.retweet_count! + METRICS.quote_count!);
  });

  it("stores null, never zero, for a counter the reading lacks", () => {
    const observation = observationFromPublicMetrics({ impression_count: 10 }, "2026-09-21");
    expect(observation).toMatchObject({ likes: null, reposts: null, replies: null, bookmarks: null });
  });

  it("returns nothing for a reading with no impression count", () => {
    expect(observationFromPublicMetrics({ like_count: 3 }, "2026-09-21")).toBeNull();
  });
});

describe("planObservationAppends", () => {
  const readings = new Map([["111", METRICS]]);

  it("appends a reading dated after the latest one", () => {
    const [outcome] = planObservationAppends([post("post-a", "111", reading(400_000, "2026-09-17"))], readings, "2026-09-21");
    expect(outcome).toMatchObject({ postId: "post-a", kind: "append", previous: { observed_at: "2026-09-17" } });
  });

  it("skips a post that already holds a reading on that date, so a re-run changes nothing", () => {
    const [outcome] = planObservationAppends([post("post-a", "111", reading(400_000, "2026-09-21"))], readings, "2026-09-21");
    expect(outcome?.kind).toBe("skip");
  });

  it("skips a post whose latest reading is newer, rather than breaking the order", () => {
    const [outcome] = planObservationAppends([post("post-a", "111", reading(400_000, "2026-09-30"))], readings, "2026-09-21");
    expect(outcome?.kind).toBe("skip");
  });

  it("skips a post the reading does not cover, and one with no status id", () => {
    const outcomes = planObservationAppends(
      [post("post-b", "222", reading(1, "2026-09-01")), { id: "post-c", url: "https://example.com", observations: [reading(1, "2026-09-01")] }],
      readings,
      "2026-09-21",
    );
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(["skip", "skip"]);
  });
});

describe("applyObservationAppends", () => {
  it("appends after the existing history and leaves it intact", () => {
    const original = post("post-a", "111", reading(400_000, "2026-09-17"));
    const outcomes = planObservationAppends([original], new Map([["111", METRICS]]), "2026-09-21");
    const [updated] = applyObservationAppends([original], outcomes);

    expect(updated?.observations.map((observation) => observation.observed_at)).toEqual(["2026-09-17", "2026-09-21"]);
    expect(updated?.observations[0]).toBe(original.observations[0]);
    expect(original.observations).toHaveLength(1);
  });

  it("returns an untouched post as the same object", () => {
    const untouched = post("post-b", "222", reading(1, "2026-09-01"));
    const [result] = applyObservationAppends([untouched], []);
    expect(result).toBe(untouched);
  });

  it("produces a file the schema accepts when applied to the live dataset", () => {
    const posts = livePostsJson as unknown as RefreshablePost[];
    const readings = new Map<string, ApiPublicMetrics>();
    for (const entry of posts) readings.set(statusIdFromUrl(entry.url)!, METRICS);

    const updated = applyObservationAppends(posts, planObservationAppends(posts, readings, "2999-01-01"));
    expect(postsFileSchema.safeParse(updated).success).toBe(true);
    expect(updated.every((entry, index) => entry.observations.length === posts[index]!.observations.length + 1)).toBe(true);
  });
});
