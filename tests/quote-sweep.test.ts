/**
 * The quote sweep's decisions (docs/WORKPLAN.md B10), tested without an API call.
 *
 * These are the three judgements that decide what a human is asked to read, and
 * each is tested against the shapes the 2026-09-20 measurement actually returned
 * — retweets and replies mixed into the quote timeline, `verified_type: "blue"`
 * standing for nothing, an account already recorded under a null `account` field.
 */
import { describe, expect, it } from "vitest";

import {
  isQuoteOfPost,
  knownAccountKeys,
  signalFlags,
  LARGE_FOLLOWING,
  SELF_ACCOUNT,
  SELF_ACCOUNTS,
} from "@/lib/sweep/quote-candidates";

const POST_ID = "2047676942128685469";

describe("isQuoteOfPost", () => {
  it("accepts a quote of this post", () => {
    expect(isQuoteOfPost([{ type: "quoted", id: POST_ID }], POST_ID)).toBe(true);
  });

  it("rejects a reply inside the post's quote thread", () => {
    // 151 of 392 measured entries were this shape — a reply to someone else's
    // quote, which is not an amplification of the tracked post.
    expect(isQuoteOfPost([{ type: "replied_to", id: "999" }], POST_ID)).toBe(false);
  });

  it("rejects a retweet, which carries no act of its own", () => {
    // B14's standing rule: someone else's quote post travelling belongs to the
    // account that wrote it, never to the account that passed it on.
    expect(isQuoteOfPost([{ type: "retweeted", id: POST_ID }], POST_ID)).toBe(false);
  });

  it("rejects a quote of a different post", () => {
    expect(isQuoteOfPost([{ type: "quoted", id: "123456" }], POST_ID)).toBe(false);
  });

  it("accepts an entry that both quotes this post and replies to something else", () => {
    expect(
      isQuoteOfPost(
        [
          { type: "replied_to", id: "555" },
          { type: "quoted", id: POST_ID },
        ],
        POST_ID,
      ),
    ).toBe(true);
  });

  it("rejects an entry with no references at all", () => {
    expect(isQuoteOfPost(undefined, POST_ID)).toBe(false);
    expect(isQuoteOfPost([], POST_ID)).toBe(false);
  });
});

describe("knownAccountKeys", () => {
  it("always holds the project's own account", () => {
    expect(knownAccountKeys([]).has(SELF_ACCOUNT)).toBe(true);
  });

  it("also holds the project's operator, who is not a third-party amplifier", () => {
    // @broom0x is LayoffHedge's founder (maintainer-confirmed 2026-09-21). The sweep
    // offered him as a discovery on the congressional-district post; an operator
    // sharing their own project's post is the subject, not an amplifier of it.
    const known = knownAccountKeys([]);
    for (const self of SELF_ACCOUNTS) expect(known.has(self)).toBe(true);
    expect(known.has("@broom0x")).toBe(true);
  });

  it("indexes the stored account case-insensitively", () => {
    const known = knownAccountKeys([
      { account: "@RepBrandonGill", evidence_url: "https://x.com/RepBrandonGill/status/1" },
    ]);
    expect(known.has("@repbrandongill")).toBe(true);
  });

  it("recovers the handle from evidence_url when account is null", () => {
    // The two must not disagree about whether an account is already known.
    const known = knownAccountKeys([
      { account: null, evidence_url: "https://x.com/SomeOfficial/status/17" },
    ]);
    expect(known.has("@someofficial")).toBe(true);
  });

  it("reads a twitter.com evidence url as well as an x.com one", () => {
    const known = knownAccountKeys([
      { account: null, evidence_url: "https://twitter.com/LegacyHandle/status/9?s=20" },
    ]);
    expect(known.has("@legacyhandle")).toBe(true);
  });

  it("ignores an evidence url that names no handle", () => {
    const known = knownAccountKeys([
      { account: null, evidence_url: "https://example.com/article/layoffs" },
    ]);
    expect(known.size).toBe(SELF_ACCOUNTS.length); // only the project's own accounts
  });
});

describe("signalFlags", () => {
  it("flags a government verified_type", () => {
    const flags = signalFlags({ username: "x", name: "Office", verified_type: "government" });
    expect(flags).toContain("government-verified");
  });

  it("does not treat a blue check as a public role", () => {
    // Measured: 48 of 105 quoting accounts were "blue" — a paid subscription.
    expect(
      signalFlags({
        username: "someone",
        name: "Someone",
        description: "genuine cowboy in a world that isn't",
        verified_type: "blue",
        public_metrics: { followers_count: 32_182 },
      }),
    ).toEqual([]);
  });

  it("flags a role phrase found in the description", () => {
    const flags = signalFlags({
      username: "reporter",
      name: "A Name",
      description: "Technology reporter covering labour markets",
    });
    expect(flags.some((flag) => flag.startsWith("role-phrase:"))).toBe(true);
  });

  it("flags a role phrase found in the display name", () => {
    const flags = signalFlags({ username: "gov", name: "Governor Jane Doe" });
    expect(flags.some((flag) => flag.includes("governor"))).toBe(true);
  });

  it("flags a large following at the inclusive boundary", () => {
    expect(
      signalFlags({
        username: "big",
        name: "Big",
        public_metrics: { followers_count: LARGE_FOLLOWING },
      }),
    ).toContain("large-following");
    expect(
      signalFlags({
        username: "small",
        name: "Small",
        public_metrics: { followers_count: LARGE_FOLLOWING - 1 },
      }),
    ).not.toContain("large-following");
  });

  it("returns no flags for an account that describes nothing", () => {
    expect(signalFlags({ username: "nobody", name: "nobody" })).toEqual([]);
  });

  it("caps the phrases it prints without dropping the flag", () => {
    const flags = signalFlags({
      username: "many",
      name: "Editor",
      description: "Founder, CEO, columnist, reporter and economist",
    });
    const rolePhrase = flags.find((flag) => flag.startsWith("role-phrase:"));
    expect(rolePhrase).toBeDefined();
    expect(rolePhrase!.split(",").length).toBeLessThanOrEqual(3);
  });

  it("never returns a score or a rank — only named flags", () => {
    const flags = signalFlags({
      username: "senator",
      name: "Senator Jane Doe",
      verified_type: "government",
      public_metrics: { followers_count: 900_000 },
    });
    // CLAUDE.md §3 — no invented Influence/Attention number, here or anywhere.
    expect(flags).toEqual([
      "government-verified",
      expect.stringContaining("role-phrase:"),
      "large-following",
    ]);
    for (const flag of flags) expect(typeof flag).toBe("string");
  });
});

describe("signalFlags and parody accounts", () => {
  it("suppresses a role phrase on a declared parody account", () => {
    // The real false positive from the 2026-09-21 review: satire tripping the
    // `economist` phrase. A parody account claims no role, so the flag is wrong
    // rather than merely noisy.
    expect(
      signalFlags({
        username: "KamalaLies",
        name: "Expert, PhD., MD, DDS, Esq.",
        description: "Certified Fact Checker. Nobel laureate economist. Islamic Scholar",
        parody: true,
      }),
    ).toEqual([]);
  });

  it("still flags the same account when it is not marked parody", () => {
    expect(
      signalFlags({
        username: "KamalaLies",
        name: "Expert",
        description: "Nobel laureate economist",
      }).some((flag) => flag.startsWith("role-phrase")),
    ).toBe(true);
  });

  it("keeps the government flag on a parody account rather than hiding it", () => {
    // `verified_type` is assigned by the platform, not written by the account,
    // so parody has no bearing on it. Only the self-described phrase is dropped.
    expect(
      signalFlags({ username: "x", name: "Office", verified_type: "government", parody: true }),
    ).toContain("government-verified");
  });
});
