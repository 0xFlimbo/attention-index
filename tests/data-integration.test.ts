/**
 * Integration smoke test against the real `data/` files — the closest thing to a
 * route smoke test without adding a rendering dependency (docs/ENGINEERING.md §9).
 * If these numbers ever drift, either the dataset changed intentionally (update
 * this test) or something upstream broke silently.
 */
import { describe, expect, it } from "vitest";
import { getPosts, getAmplifications, getMediaReferences, getProjectMetadata } from "@/lib/data";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { getAmplificationMetrics } from "@/lib/metrics/amplification";
import { getMediaMetrics } from "@/lib/metrics/media";

describe("real dataset — derived metrics", () => {
  it("matches the documented B1 acceptance values", () => {
    const attention = getAttentionMetrics(getPosts());
    expect(attention.trackedPostCount).toBe(20);
    expect(attention.postsOver1M).toBe(17);
    expect(attention.postsOver5M).toBe(0);
    expect(attention.postsOver10M).toBe(0);
    expect(attention.totalObservedViews).toBe(36_669_500);
    expect(attention.topPost?.views).toBe(4_500_000);
    // Two posts tie at 4.5M — the earlier-published one wins the tie-break.
    expect(attention.topPost?.post.id).toBe("post-layoffai-2063640043387052174");

    const amplification = getAmplificationMetrics(getAmplifications());
    expect(amplification.verifiedAmplificationCount).toBe(5);

    const media = getMediaMetrics(getMediaReferences());
    expect(media.verifiedMediaReferenceCount).toBe(0);
  });

  it("loads project metadata with the required disclaimer", () => {
    const project = getProjectMetadata();
    expect(project.disclaimer).toMatch(/independent/i);
    expect(project.repository_url).toBeNull();
  });
});
