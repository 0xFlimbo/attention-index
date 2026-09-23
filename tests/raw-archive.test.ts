/**
 * Where a billed response goes the moment it arrives
 * (`src/lib/sweep/raw-archive.ts`, `docs/TOOLS.md §1`).
 *
 * The naming is tested rather than eyeballed because the archive is read months
 * later by someone deciding whether a question can be answered without paying
 * again — and a folder of `response-3.json` does not help them.
 */
import { describe, expect, it } from "vitest";

import {
  archiveEntry,
  endpointOf,
  rawArchivePath,
  slugify,
} from "@/lib/sweep/raw-archive";

describe("rawArchivePath", () => {
  it("files a response under its day, in raw/, named for what the call was for", () => {
    expect(rawArchivePath("counts-window-sizing", "2026-09-21T18:04:33.000Z")).toBe(
      "x-api-2026-09-21/raw/counts-window-sizing-180433.json",
    );
  });

  it("keeps two calls in the same second from colliding by label", () => {
    const at = "2026-09-21T18:04:33.000Z";
    expect(rawArchivePath("search-all-page-1", at)).not.toBe(rawArchivePath("search-all-page-2", at));
  });
});

describe("slugify", () => {
  it("turns a human label into a readable file name", () => {
    expect(slugify("Quote tweets: 2087170419027526094, page 3")).toBe(
      "quote-tweets-2087170419027526094-page-3",
    );
  });

  it("never produces an empty or dangling-hyphen name", () => {
    expect(slugify("???")).toBe("response");
    expect(slugify("")).toBe("response");
    expect(slugify("trailing --- ")).toBe("trailing");
  });
});

describe("endpointOf", () => {
  it("keeps the path and drops the query, which can carry a token", () => {
    // The one rule that matters here: a raw URL is never written to disk whole.
    expect(endpointOf("https://api.x.com/2/tweets/search/all?query=x&max_results=500")).toBe(
      "/2/tweets/search/all",
    );
  });

  it("survives a malformed url rather than throwing mid-archive", () => {
    // Throwing here would lose the very response this function exists to keep.
    expect(endpointOf("not a url?a=b")).toBe("not a url");
  });
});

describe("archiveEntry", () => {
  it("wraps the body with when, where and why — and stores the body untouched", () => {
    const body = { data: [{ id: "1" }], meta: { result_count: 1 } };
    const entry = archiveEntry(
      "https://api.x.com/2/tweets/counts/all?query=secret",
      "counts-window-sizing",
      body,
      new Date("2026-09-21T18:04:33.000Z"),
    );

    expect(entry).toEqual({
      fetched_at: "2026-09-21T18:04:33.000Z",
      endpoint: "/2/tweets/counts/all",
      label: "counts-window-sizing",
      body,
    });
    // The body is the evidence; anything less than byte-identical is a summary.
    expect(entry.body).toBe(body);
  });

  it("writes no query string, so a credential cannot reach the archive", () => {
    const entry = archiveEntry("https://api.x.com/2/users?ids=1&token=leaked", "profiles", {});
    expect(JSON.stringify(entry)).not.toContain("leaked");
  });
});
