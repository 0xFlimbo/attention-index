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
  it("matches the current dataset's expected values", () => {
    const attention = getAttentionMetrics(getPosts());
    expect(attention.trackedPostCount).toBe(21);
    expect(attention.postsOver1M).toBe(17);
    expect(attention.postsOver5M).toBe(0);
    expect(attention.postsOver10M).toBe(0);
    expect(attention.totalObservedViews).toBe(37_096_943);
    expect(attention.topPost?.views).toBe(4_500_000);
    // Two posts tie at 4.5M — the earlier-published one wins the tie-break.
    expect(attention.topPost?.post.id).toBe("post-layoffai-2063640043387052174");

    const amplification = getAmplificationMetrics(getAmplifications());
    expect(amplification.verifiedAmplificationCount).toBe(10);

    const media = getMediaMetrics(getMediaReferences());
    // 100 records were imported from the official press page; only the reviewed
    // subset is verified, so the rest must stay out of the public count.
    expect(media.verifiedMediaReferenceCount).toBe(18);
    expect(media.uniquePublicationCount).toBe(12);
    expect(getMediaReferences().length).toBe(100);
  });

  it("loads project metadata with the required disclaimer", () => {
    const project = getProjectMetadata();
    expect(project.disclaimer).toMatch(/independent/i);
    expect(project.repository_url).toBeNull();
  });
});
