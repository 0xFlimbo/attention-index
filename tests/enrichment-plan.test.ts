import { describe, expect, it } from "vitest";

import {
  COST_PER_POST_READ,
  COST_PER_USER_READ,
  IDS_PER_REQUEST,
  planEnrichment,
} from "../src/lib/metrics/enrichment-plan";

describe("planEnrichment", () => {
  it("makes zero requests and costs nothing when nothing is eligible", () => {
    const plan = planEnrichment([], []);
    expect(plan).toEqual({
      postIdCount: 0,
      amplificationIdCount: 0,
      totalIdCount: 0,
      requestCount: 0,
      postReadCost: 0,
      maxUserReadCost: 0,
      minCost: 0,
      maxCost: 0,
    });
  });

  it("counts ids and models cost as a certain post-read floor plus an author-read ceiling", () => {
    const postIds = ["1", "2", "3"];
    const ampIds = ["4", "5"];
    const plan = planEnrichment(postIds, ampIds);

    expect(plan.postIdCount).toBe(3);
    expect(plan.amplificationIdCount).toBe(2);
    expect(plan.totalIdCount).toBe(5);
    expect(plan.postReadCost).toBeCloseTo(5 * COST_PER_POST_READ);
    expect(plan.maxUserReadCost).toBeCloseTo(5 * COST_PER_USER_READ);
    expect(plan.minCost).toBeCloseTo(plan.postReadCost);
    expect(plan.maxCost).toBeCloseTo(plan.postReadCost + plan.maxUserReadCost);
  });

  it("batches posts and amplifications separately, so a partial-100 remainder in each still costs a request", () => {
    const postIds = Array.from({ length: 100 }, (_, i) => `post-${i}`);
    const ampIds = ["only-one"];
    const plan = planEnrichment(postIds, ampIds);

    // 1 full batch of posts + 1 partial batch of amplifications = 2 requests,
    // not 1 (which combining the two lists before chunking would produce).
    expect(plan.requestCount).toBe(2);
  });

  it("batches in groups no larger than the endpoint's own ceiling", () => {
    const postIds = Array.from({ length: IDS_PER_REQUEST + 1 }, (_, i) => `post-${i}`);
    const plan = planEnrichment(postIds, []);
    expect(plan.requestCount).toBe(2);
  });
});
