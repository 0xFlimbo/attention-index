/**
 * The quote sweep's decisions, tested without an API call.
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
  verificationClaims,
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
    // This project's standing rule: someone else's quote post travelling belongs to the
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
    // docs/DATA.md §10 — no invented Influence/Attention number, here or anywhere.
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

describe("verificationClaims", () => {
  /*
   * Verification is a stage of the track (maintainer instruction, 2026-09-21),
   * so the tool emits the claims rather than leaving them to memory. The
   * calibration sweep is why: of three accounts whose bios claimed a
   * journalistic role, checking against the outlets recorded one, recategorised
   * one and rejected one.
   */
  it("turns a role-phrase flag into a claim that names where to check it", () => {
    const claims = verificationClaims(
      { username: "kylenabecker", name: "Kyle Becker", description: "RedState columnist" },
      ["role-phrase: columnist", "large-following"],
    );
    expect(claims.some((claim) => claim.includes("NOT this account"))).toBe(true);
    expect(claims.some((claim) => claim.includes("columnist"))).toBe(true);
  });

  it("asks whether a register name match is the same person or a namesake", () => {
    // `@RussellFosterTX` matched a historical New York representative named
    // Foster and is a former candidate for a Texas seat — a coincidence.
    const claims = verificationClaims(
      { username: "RussellFosterTX", name: "Russell Foster A New Texas" },
      ["register-match (name): A. Foster, rep-NY, historical"],
    );
    expect(claims.some((claim) => claim.includes("namesake"))).toBe(true);
  });

  it("always asks for the act to be read, even for an unflagged account", () => {
    // The check that has disqualified the most accounts: a 1.48M-follower
    // account was rejected because its post was a slogan and a link.
    const claims = verificationClaims({ username: "someone", name: "Someone" }, []);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toContain("bare link");
  });

  it("never returns a verdict, only a claim and its test", () => {
    const claims = verificationClaims(
      { username: "x", name: "X", verified_type: "government" },
      ["government-verified"],
    );
    // No profile field can establish a role; saying so would be the bug.
    for (const claim of claims) {
      expect(claim).not.toMatch(/\bverified\b(?! )|confirmed as|is a journalist/i);
    }
  });
});
