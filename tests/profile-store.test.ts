/**
 * The paid-profile store (docs/WORKPLAN.md B10, Track B).
 *
 * A user read costs $0.010 and a follower count is an observation that cannot be
 * re-taken. These tests guard the two ways that money gets lost: a profile the
 * scanner fails to recognise, and a fresh reading overwritten by a stale one.
 */
import { describe, expect, it } from "vitest";

import {
  collectUserObjects,
  mergeProfiles,
  type PaidProfile,
} from "@/lib/sweep/profile-store";

describe("collectUserObjects", () => {
  it("finds profiles under a top-level `users` key", () => {
    // The shape `h1b-sweep.json` uses.
    const found = collectUserObjects({ users: [{ id: "1", username: "alpha" }] });
    expect(found.map((user) => user.username)).toEqual(["alpha"]);
  });

  it("finds profiles under `includes.users`", () => {
    // The shape an expansions response uses.
    const found = collectUserObjects({
      data: [{ id: "99", text: "a tweet", author_id: "1" }],
      includes: { users: [{ id: "1", username: "beta" }] },
    });
    expect(found.map((user) => user.username)).toEqual(["beta"]);
  });

  it("finds profiles nested inside a sweep report", () => {
    const found = collectUserObjects({
      swept_at: "2026-09-21",
      results: [{ candidates: [{ profile: { id: "7", username: "gamma" } }] }],
    });
    expect(found.map((user) => user.username)).toEqual(["gamma"]);
  });

  it("does not mistake a tweet for a profile", () => {
    // A tweet has `id` but never `username`; that pair is what identifies a user.
    expect(collectUserObjects({ data: [{ id: "5", text: "hello", author_id: "1" }] })).toEqual([]);
  });

  it("does not descend into a profile it has already recognised", () => {
    const found = collectUserObjects({
      users: [{ id: "1", username: "alpha", public_metrics: { followers_count: 10 } }],
    });
    expect(found).toHaveLength(1);
  });

  it("survives nulls, arrays and primitives without throwing", () => {
    expect(collectUserObjects(null)).toEqual([]);
    expect(collectUserObjects([1, "two", null, { nothing: true }])).toEqual([]);
  });
});

describe("mergeProfiles", () => {
  const store = (): Map<string, PaidProfile> => new Map();

  it("adds a profile that is not held yet", () => {
    const target = store();
    expect(mergeProfiles(target, [{ id: "1", username: "alpha" }])).toEqual({
      added: 1,
      replaced: 0,
    });
    expect(target.size).toBe(1);
  });

  it("keeps the newer reading when both are dated", () => {
    const target = store();
    mergeProfiles(target, [
      { id: "1", username: "alpha", observed_at: "2026-09-20", public_metrics: { followers_count: 10 } },
    ]);
    mergeProfiles(target, [
      { id: "1", username: "alpha", observed_at: "2026-09-21", public_metrics: { followers_count: 20 } },
    ]);
    expect(target.get("1")!.public_metrics!.followers_count).toBe(20);
  });

  it("never lets an older reading displace a newer one", () => {
    const target = store();
    mergeProfiles(target, [{ id: "1", username: "alpha", observed_at: "2026-09-21" }]);
    const result = mergeProfiles(target, [{ id: "1", username: "alpha", observed_at: "2026-09-20" }]);
    expect(result.replaced).toBe(0);
    expect(target.get("1")!.observed_at).toBe("2026-09-21");
  });

  it("never lets an undated reading displace a dated one", () => {
    // An undated profile cannot be shown to be the more recent of the two, and
    // `docs/DATA.md §5` will not have a reading replaced by an unknown one.
    const target = store();
    mergeProfiles(target, [{ id: "1", username: "alpha", observed_at: "2026-09-20" }]);
    mergeProfiles(target, [{ id: "1", username: "alpha" }]);
    expect(target.get("1")!.observed_at).toBe("2026-09-20");
  });

  it("lets a dated reading replace an undated one", () => {
    const target = store();
    mergeProfiles(target, [{ id: "1", username: "alpha" }]);
    const result = mergeProfiles(target, [{ id: "1", username: "alpha", observed_at: "2026-09-21" }]);
    expect(result.replaced).toBe(1);
  });

  it("skips malformed entries rather than storing them", () => {
    const target = store();
    const result = mergeProfiles(target, [
      { id: "", username: "no-id" } as PaidProfile,
      { id: "2", username: "" } as PaidProfile,
    ]);
    expect(result.added).toBe(0);
    expect(target.size).toBe(0);
  });
});
