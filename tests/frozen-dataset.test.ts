/**
 * The literal snapshot (docs/WORKPLAN.md B10–B12, "value-pinned tests").
 *
 * `tests/data-integration.test.ts` used to pin every headline figure of the live
 * `data/` files as a literal. That is the right guard for a hand-made edit — it
 * forces a human to confirm a headline number moved on purpose — and the wrong
 * one for a dataset that is about to be widened by a sweep, because the suite
 * goes red on the first new record and a job that edits its own expectations to
 * go green is not a guard at all.
 *
 * The split the WORKPLAN prescribes: the live files are asserted by *relationship*
 * next door, and the literal snapshot moves here, onto a frozen copy of the
 * dataset as it stood on 2026-09-20. No assertion was deleted — `trackedPostCount
 * 32`, `totalObservedViews 43_625_943` and `verifiedAmplificationCount 10` are all
 * still checked, against an input that cannot drift underneath them.
 *
 * What this therefore guards is the **derivation chain**, not the dataset: schema
 * parse → loader eligibility rule → pure metric → figure. A change in how a view
 * count is read, how eligibility is decided, or how provenance is split moves one
 * of these numbers and fails here. Adding an amplification does not.
 *
 * The fixture is frozen input, never a target the live data should match. It is
 * updated only when a schema migration makes it unparseable (B18 was such a
 * change), and then the figures below are re-derived and re-read by a human, not
 * pasted from the run that failed.
 */
import { describe, expect, it } from "vitest";

import frozenPostsJson from "./fixtures/dataset-2026-09-20/posts.json";
import frozenAmplificationsJson from "./fixtures/dataset-2026-09-20/amplifications.json";
import frozenMediaJson from "./fixtures/dataset-2026-09-20/media.json";

import { postsFileSchema } from "@/schemas/post.schema";
import { amplificationsFileSchema } from "@/schemas/amplification.schema";
import { mediaFileSchema } from "@/schemas/media.schema";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { getAmplificationMetrics } from "@/lib/metrics/amplification";
import { getMediaMetrics } from "@/lib/metrics/media";
import { selectAttentionGridCells } from "@/lib/metrics/attention-grid";
import { selectCrossoverCategories } from "@/lib/metrics/amplification";
import { selectPublicationReferences } from "@/lib/metrics/media";

const frozenPosts = postsFileSchema.parse(frozenPostsJson);
const frozenAmplifications = amplificationsFileSchema.parse(frozenAmplificationsJson);
const frozenMedia = mediaFileSchema.parse(frozenMediaJson);

describe("frozen dataset (2026-09-20) — derived figures", () => {
  it("derives the attention figures the dataset stood at", () => {
    const attention = getAttentionMetrics(frozenPosts);

    expect(attention.trackedPostCount).toBe(32);
    expect(attention.postsOver1M).toBe(17);
    expect(attention.postsOver5M).toBe(0);
    expect(attention.postsOver10M).toBe(0);
    expect(attention.totalObservedViews).toBe(43_625_943);
    expect(attention.topPost?.views).toBe(4_500_000);
    // Two posts tie at 4.5M — the earlier-published one wins the tie-break.
    expect(attention.topPost?.post.id).toBe("post-layoffai-2063640043387052174");
  });

  it("resolves the Attention Grid to the four cells the homepage was reviewed at", () => {
    const cells = selectAttentionGridCells(getAttentionMetrics(frozenPosts));

    expect(cells.map((cell) => cell.label)).toEqual([
      "POSTS ABOVE 1M",
      "TRACKED POSTS",
      "MOST VIEWED TRACKED POST",
      "OBSERVED VIEWS ACROSS TRACKED POSTS",
    ]);
    expect(cells.map((cell) => cell.value)).toEqual(["17", "32", "4.5M", "43.6M"]);
  });

  it("derives the amplification figures the dataset stood at", () => {
    const amplification = getAmplificationMetrics(frozenAmplifications);

    expect(amplification.verifiedAmplificationCount).toBe(10);
    expect(amplification.countsByCategory).toEqual({
      government: 2,
      politics: 6,
      journalism: 0,
      media: 0,
      business: 0,
      tech: 1,
      public_figure: 1,
      other: 0,
    });

    // Four categories hold no record, so the Crossover map draws four nodes
    // (docs/DATA.md §10) — the gap B10's sweep is aimed at.
    expect(selectCrossoverCategories(frozenAmplifications).map((c) => c.label)).toEqual([
      "GOVERNMENT",
      "POLITICS",
      "TECH",
      "PUBLIC FIGURES",
    ]);
  });

  it("derives the media figures the dataset stood at", () => {
    const media = getMediaMetrics(frozenMedia);

    expect(frozenMedia.length).toBe(103);
    expect(media.verifiedMediaReferenceCount).toBe(94);
    expect(media.uniquePublicationCount).toBe(51);
    expect(selectPublicationReferences(frozenMedia).length).toBe(51);
    // docs/DATA.md §10 — the provenance split always partitions the total.
    expect(media.originalReferenceCount + media.syndicatedReferenceCount).toBe(
      media.verifiedMediaReferenceCount,
    );
  });
});
