/**
 * The amplifier screen: which paid posts are acts on the project, and which
 * accounts are already decided.
 *
 * Both failures here are silent. A missed act drops an account a human should
 * have read; a register that fails to match re-proposes an account already
 * turned down, and the reason has to be argued again from scratch.
 */
import { describe, expect, it } from "vitest";

import {
  actsByAuthor,
  classifyAct,
  collectPostObjects,
  isProjectSearchFile,
  projectPostIds,
  projectSearchMatchIds,
  selfAuthorIds,
  type PaidPost,
} from "@/lib/sweep/amplifier-acts";
import {
  amplifierDecisionsFileSchema,
  findDecision,
  type AmplifierDecision,
} from "@/lib/sweep/amplifier-decisions";

const SELF = new Set(["100"]);
const PROJECT = new Set(["900"]);

function post(overrides: Partial<PaidPost>): PaidPost {
  return { id: "1", author_id: "7", text: "", created_at: "2026-08-14T10:00:00.000Z", ...overrides };
}

describe("classifyAct", () => {
  it("reads a quote of a project post as a quote, even when it also types the handle", () => {
    const act = classifyAct(
      post({ text: "@LayoffAI look", referenced_tweets: [{ type: "quoted", id: "900" }] }),
      PROJECT,
      SELF,
    );
    expect(act).toMatchObject({ kind: "quote_post", targetId: "900", date: "2026-08-14" });
  });

  it("reads a reply to a project post as a reply", () => {
    const act = classifyAct(post({ referenced_tweets: [{ type: "replied_to", id: "900" }] }), PROJECT, SELF);
    expect(act?.kind).toBe("reply");
  });

  it("does not count a quote of someone else's post", () => {
    expect(classifyAct(post({ referenced_tweets: [{ type: "quoted", id: "555" }] }), PROJECT, SELF)).toBeNull();
  });

  it("finds a mention by handle, by brand in either spelling, and by linked domain", () => {
    expect(classifyAct(post({ text: "via @layoffai" }), PROJECT, SELF)?.kind).toBe("mention");
    expect(classifyAct(post({ text: "data from Layoff Hedge" }), PROJECT, SELF)?.kind).toBe("mention");
    const linked = post({ text: "https://t.co/x", entities: { urls: [{ expanded_url: "https://layoffhedge.com/h1b" }] } });
    expect(classifyAct(linked, PROJECT, SELF)?.kind).toBe("mention");
  });

  it("reads the long text, where a credit past 280 characters lives", () => {
    const long = post({ text: "An Indiana university faced…", note_tweet: { text: "… per LayoffHedge's report" } });
    expect(classifyAct(long, PROJECT, SELF)?.kind).toBe("mention");
    const current = post({ text: "cut", note_post: { text: "… per LayoffHedge" } });
    expect(classifyAct(current, PROJECT, SELF)?.kind).toBe("mention");
  });

  it("counts a project-search result as a mention when only a t.co link shows", () => {
    // The Carson and Chaffetz case: the search matched the expanded URL, the
    // stored response kept only the short link.
    const bare = post({ id: "42", text: "Helpful. https://t.co/RXpRz3D14R" });
    expect(classifyAct(bare, PROJECT, SELF)).toBeNull();
    expect(classifyAct(bare, PROJECT, SELF, new Set(["42"]))?.kind).toBe("mention");
  });

  it("never counts the project's own accounts", () => {
    expect(classifyAct(post({ author_id: "100", text: "@LayoffAI" }), PROJECT, SELF)).toBeNull();
  });
});

describe("project posts and accounts", () => {
  it("resolves the project's own account ids from profiles", () => {
    const ids = selfAuthorIds([
      { id: "100", username: "LayoffAI" },
      { id: "101", username: "broom0x" },
      { id: "7", username: "someone" },
    ]);
    expect([...ids].sort()).toEqual(["100", "101"]);
  });

  it("adds untracked posts authored by the project to the tracked ones", () => {
    const ids = projectPostIds(["900"], [post({ id: "901", author_id: "100" }), post({ id: "902" })], SELF);
    expect([...ids].sort()).toEqual(["900", "901"]);
  });
});

describe("project search files", () => {
  it("recognises a stored query, a search archive entry and the Track A prefix", () => {
    expect(isProjectSearchFile("x/discovery.json", { query: "(@LayoffAI OR layoffhedge)" })).toBe(true);
    expect(isProjectSearchFile("x/raw/a.json", { endpoint: "/2/tweets/search/all", body: {} })).toBe(true);
    expect(isProjectSearchFile("x-api-2026-09-21/track-a-incremental.json", { data: [] })).toBe(true);
  });

  it("does not treat a quote sweep or an unrelated query as a project search", () => {
    expect(isProjectSearchFile("quote-sweeps/raw/1.json", { endpoint: "/2/tweets/1/quote_tweets" })).toBe(false);
    expect(isProjectSearchFile("x/other.json", { query: "from:someone" })).toBe(false);
    expect(isProjectSearchFile("x/list.json", [])).toBe(false);
  });

  it("takes the results and leaves out the posts they quoted", () => {
    const response = {
      data: [{ id: "1", author_id: "7", text: "result" }],
      includes: { tweets: [{ id: "2", author_id: "8", text: "quoted, did not match" }] },
    };
    expect([...projectSearchMatchIds(response)]).toEqual(["1"]);
    expect(collectPostObjects(response).map((found) => found.id)).toEqual(["1", "2"]);
  });
});

describe("actsByAuthor", () => {
  it("keeps one act per post, taking the copy that shows the act", () => {
    // The same post stored truncated by a search and in full by a lookup.
    const truncated = post({ id: "5", text: "An Indiana university…" });
    const full = post({ id: "5", text: "An Indiana university…", note_tweet: { text: "… LayoffHedge found" } });
    const acts = actsByAuthor([truncated, full, full], PROJECT, SELF);
    expect(acts.get("7")).toHaveLength(1);
  });

  it("orders an author's acts oldest first", () => {
    const acts = actsByAuthor(
      [
        post({ id: "2", text: "@LayoffAI", created_at: "2026-09-01T00:00:00.000Z" }),
        post({ id: "1", text: "@LayoffAI", created_at: "2026-08-01T00:00:00.000Z" }),
      ],
      PROJECT,
      SELF,
    );
    expect(acts.get("7")?.map((act) => act.postId)).toEqual(["1", "2"]);
  });
});

describe("the decisions register", () => {
  const decisions: AmplifierDecision[] = [
    { account: "@DecidedAccount", x_user_id: "1498", verdict: "out", reason: "pseudonym", decided_at: "2026-09-27" },
    { account: "@NoIdOnFile", verdict: "out", reason: "pseudonym", decided_at: "2026-09-20" },
  ];

  it("matches by account id first, so a renamed account is still decided", () => {
    expect(findDecision(decisions, { id: "1498", username: "NewName" })?.account).toBe("@DecidedAccount");
  });

  it("matches by handle, case-insensitively, when no id is on file", () => {
    expect(findDecision(decisions, { id: "5", username: "noidonfile" })?.account).toBe("@NoIdOnFile");
  });

  it("does not match a different account that took a decided handle", () => {
    expect(findDecision(decisions, { id: "9999", username: "DecidedAccount" })).toBeUndefined();
  });

  it("refuses a held account with no reopen condition", () => {
    const held = [{ account: "@x", verdict: "held", reason: "no source", decided_at: "2026-09-27" }];
    expect(amplifierDecisionsFileSchema.safeParse(held).success).toBe(false);
    const withCondition = [{ ...held[0], reopen_if: "an independent source links the handle" }];
    expect(amplifierDecisionsFileSchema.safeParse(withCondition).success).toBe(true);
  });

  it("refuses an `in` verdict: a recorded account lives in data/amplifications.json", () => {
    const recorded = [{ account: "@x", verdict: "in", reason: "recorded", decided_at: "2026-09-27" }];
    expect(amplifierDecisionsFileSchema.safeParse(recorded).success).toBe(false);
  });
});
