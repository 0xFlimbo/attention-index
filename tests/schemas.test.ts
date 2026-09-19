import { describe, expect, it } from "vitest";
import { postSchema, postsFileSchema } from "../src/schemas/post.schema";
import { amplificationSchema } from "../src/schemas/amplification.schema";
import { isoDateString, absoluteUrlString } from "../src/schemas/shared";
import { findDanglingRelatedPostIds } from "../src/lib/validation/related-post-reference";

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
    observations: [
      {
        views: 1_000_000,
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
    ...overrides,
  };
}

function validAmplification(overrides: Record<string, unknown> = {}) {
  return {
    id: "amp-example-1",
    entity_type: "person",
    entity_name: "Example Name",
    role: null,
    organization: null,
    category: "politics",
    action: "repost",
    date: "2026-01-01",
    platform: "x",
    account: "@example",
    evidence_url: "https://x.com/example/status/1",
    related_post_id: null,
    follower_count: null,
    follower_count_observed_at: null,
    country: null,
    featured: false,
    portrait: null,
    notes: null,
    status: "verified",
    verified_at: "2026-01-01",
    ...overrides,
  };
}

describe("isoDateString", () => {
  it("accepts a real calendar date", () => {
    expect(isoDateString.safeParse("2026-09-15").success).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(isoDateString.safeParse("2026/09/15").success).toBe(false);
    expect(isoDateString.safeParse("15-09-2026").success).toBe(false);
  });

  it("rejects a date that doesn't exist on the calendar", () => {
    expect(isoDateString.safeParse("2026-02-30").success).toBe(false);
  });
});

describe("absoluteUrlString", () => {
  it("accepts an absolute https URL", () => {
    expect(absoluteUrlString.safeParse("https://x.com/LayoffAI/status/1").success).toBe(true);
  });

  it("rejects a malformed URL", () => {
    expect(absoluteUrlString.safeParse("not a url").success).toBe(false);
    expect(absoluteUrlString.safeParse("/relative/path").success).toBe(false);
  });
});

describe("postSchema", () => {
  it("accepts a well-formed verified post", () => {
    expect(postSchema.safeParse(validPost()).success).toBe(true);
  });

  it("rejects negative views", () => {
    const result = postSchema.safeParse(
      validPost({
        observations: [
          {
            views: -1,
            likes: null,
            reposts: null,
            replies: null,
            bookmarks: null,
            observed_at: "2026-01-02",
            source: "interface",
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a verified record without verified_at", () => {
    const result = postSchema.safeParse(validPost({ verified_at: null }));
    expect(result.success).toBe(false);
  });

  it("allows a needs_review record without verified_at", () => {
    const result = postSchema.safeParse(
      validPost({ status: "needs_review", verified_at: null }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a _placeholder record whose status is not needs_review", () => {
    const result = postSchema.safeParse(validPost({ _placeholder: true, status: "verified" }));
    expect(result.success).toBe(false);
  });
});

describe("postsFileSchema — duplicate IDs", () => {
  it("rejects two records sharing the same id", () => {
    const result = postsFileSchema.safeParse([validPost(), validPost()]);
    expect(result.success).toBe(false);
  });

  it("accepts records with distinct ids", () => {
    const result = postsFileSchema.safeParse([
      validPost({ id: "post-example-1" }),
      validPost({ id: "post-example-2" }),
    ]);
    expect(result.success).toBe(true);
  });
});

describe("amplificationSchema", () => {
  it("rejects a verified amplification without evidence_url", () => {
    const withoutEvidence: Record<string, unknown> = validAmplification();
    delete withoutEvidence.evidence_url;
    const result = amplificationSchema.safeParse(withoutEvidence);
    expect(result.success).toBe(false);
  });

  it("rejects follower_count present without follower_count_observed_at", () => {
    const result = amplificationSchema.safeParse(
      validAmplification({ follower_count: 10_000, follower_count_observed_at: null }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts follower_count paired with an observation date", () => {
    const result = amplificationSchema.safeParse(
      validAmplification({ follower_count: 10_000, follower_count_observed_at: "2026-01-01" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("findDanglingRelatedPostIds", () => {
  const validPostIds = new Set(["post-a", "post-b"]);

  it("flags a related_post_id that does not exist in posts.json", () => {
    const dangling = findDanglingRelatedPostIds(
      [{ id: "amp-1", related_post_id: "post-does-not-exist" }],
      validPostIds,
    );
    expect(dangling).toEqual([{ id: "amp-1", related_post_id: "post-does-not-exist" }]);
  });

  it("allows null and existing related_post_id values", () => {
    const dangling = findDanglingRelatedPostIds(
      [
        { id: "amp-1", related_post_id: null },
        { id: "amp-2", related_post_id: "post-a" },
      ],
      validPostIds,
    );
    expect(dangling).toEqual([]);
  });
});
