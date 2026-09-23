/**
 * Integration smoke test against the real `data/` files — the closest thing to a
 * route smoke test without adding a rendering dependency (docs/ENGINEERING.md §9).
 *
 * **Asserts relationships, never values.** This file used to pin each headline
 * figure as a literal, which made the suite go red
 * on every legitimate data change — including the first record a sweep finds. The
 * literals did not disappear: they moved to `tests/frozen-dataset.test.ts`, where
 * they run against a frozen copy of the dataset that cannot drift.
 *
 * What is left here is the half that actually needs the live files: that the
 * derived figures still describe *this* dataset. Every expectation below is
 * recomputed from the JSON on disk, read independently of `src/lib` — its own
 * eligibility filter, its own latest-observation pick, its own sum — so a metric
 * that silently stops filtering, starts double-counting a post's history, or
 * reads a stale reading fails here no matter how the dataset has grown.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getPosts, getAmplifications, getMediaReferences, getProjectMetadata } from "@/lib/data";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { getAmplificationMetrics } from "@/lib/metrics/amplification";
import { getMediaMetrics } from "@/lib/metrics/media";
import { latestObservationDate, dataLastUpdated } from "@/lib/metrics/last-updated";

// ---------------------------------------------------------------------------
// The files, read as a reader would read them — no schema, no loader, no metric.
// ---------------------------------------------------------------------------

interface RawRecord {
  status: string;
  _placeholder?: boolean;
}

interface RawObservation {
  views: number;
  observed_at: string;
}

interface RawPost extends RawRecord {
  id: string;
  observations: RawObservation[];
}

interface RawAmplification extends RawRecord {
  entity_name: string;
  category: string;
}

interface RawMediaReference extends RawRecord {
  publication: string;
  provenance: string | null;
  cited_work: string | null;
}

function readRaw<T>(fileName: string): T[] {
  return JSON.parse(readFileSync(resolve(process.cwd(), "data", fileName), "utf-8")) as T[];
}

/** docs/DATA.md §3, restated rather than imported — the point is not to share the bug. */
function eligible<T extends RawRecord>(records: T[]): T[] {
  return records.filter((record) => record.status === "verified" && record._placeholder !== true);
}

/** docs/DATA.md §10 — one reading per post, the most recent. */
function latestViews(post: RawPost): number {
  return post.observations.reduce((latest, candidate) =>
    candidate.observed_at > latest.observed_at ? candidate : latest,
  ).views;
}

const rawPosts = eligible(readRaw<RawPost>("posts.json"));
const rawAmplifications = eligible(readRaw<RawAmplification>("amplifications.json"));
const rawMedia = eligible(readRaw<RawMediaReference>("media.json"));

describe("real dataset — attention metrics describe the file on disk", () => {
  const attention = getAttentionMetrics(getPosts());

  it("counts the eligible posts, and nothing else", () => {
    expect(attention.trackedPostCount).toBe(rawPosts.length);
    expect(rawPosts.length).toBeGreaterThan(0);
  });

  it("sums one reading per post, recomputed from the file", () => {
    const expected = rawPosts.reduce((sum, post) => sum + latestViews(post), 0);
    expect(attention.totalObservedViews).toBe(expected);
  });

  it("counts each threshold from the same readings the sum uses", () => {
    const views = rawPosts.map(latestViews);
    expect(attention.postsOver1M).toBe(views.filter((v) => v >= 1_000_000).length);
    expect(attention.postsOver5M).toBe(views.filter((v) => v >= 5_000_000).length);
    expect(attention.postsOver10M).toBe(views.filter((v) => v >= 10_000_000).length);
  });

  it("keeps the thresholds nested and the sum above the top post", () => {
    expect(attention.postsOver10M).toBeLessThanOrEqual(attention.postsOver5M);
    expect(attention.postsOver5M).toBeLessThanOrEqual(attention.postsOver1M);
    expect(attention.postsOver1M).toBeLessThanOrEqual(attention.trackedPostCount);
    expect(attention.totalObservedViews).toBeGreaterThanOrEqual(attention.topPost?.views ?? 0);
  });

  it("names a top post that is the highest reading in the file", () => {
    expect(attention.topPost?.views).toBe(Math.max(...rawPosts.map(latestViews)));
    const named = rawPosts.find((post) => post.id === attention.topPost?.post.id);
    expect(named).toBeDefined();
    // The date shown beside the figure is the observation's, never the post's
    // publication date (docs/ENGINEERING.md §7).
    expect(attention.topPost?.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("real dataset — amplification metrics describe the file on disk", () => {
  const amplification = getAmplificationMetrics(getAmplifications());

  it("counts the eligible amplifications, and nothing else", () => {
    expect(amplification.verifiedAmplificationCount).toBe(rawAmplifications.length);
  });

  it("splits that same total across the categories, losing no record", () => {
    const summed = Object.values(amplification.countsByCategory).reduce((a, b) => a + b, 0);
    expect(summed).toBe(rawAmplifications.length);
    for (const [category, count] of Object.entries(amplification.countsByCategory)) {
      expect(count).toBe(rawAmplifications.filter((r) => r.category === category).length);
    }
  });

  it("never counts one entity twice", () => {
    const distinct = new Set(rawAmplifications.map((r) => r.entity_name)).size;
    expect(amplification.uniqueAmplifierCount).toBe(distinct);
    expect(amplification.uniqueAmplifierCount).toBeLessThanOrEqual(
      amplification.verifiedAmplificationCount,
    );
  });
});

describe("real dataset — media metrics describe the file on disk", () => {
  const media = getMediaMetrics(getMediaReferences());

  it("counts the eligible references and their publications", () => {
    expect(media.verifiedMediaReferenceCount).toBe(rawMedia.length);
    expect(media.uniquePublicationCount).toBe(new Set(rawMedia.map((r) => r.publication)).size);
  });

  it("partitions the total by provenance (docs/DATA.md §10)", () => {
    expect(media.originalReferenceCount).toBe(
      rawMedia.filter((r) => r.provenance === "original").length,
    );
    expect(media.syndicatedReferenceCount).toBe(
      rawMedia.filter((r) => r.provenance === "syndicated").length,
    );
    expect(media.originalReferenceCount + media.syndicatedReferenceCount).toBe(
      media.verifiedMediaReferenceCount,
    );
  });

  it("counts newsroom countries over original reporting only", () => {
    expect(media.countryCount).toBe(Object.keys(media.referencesByCountry).length);
    const countryTotal = Object.values(media.referencesByCountry).reduce((a, b) => a + b, 0);
    expect(countryTotal).toBeLessThanOrEqual(media.originalReferenceCount);
  });

  it("splits the original count by cited work, losing no record (docs/DATA.md §10)", () => {
    const originals = rawMedia.filter((r) => r.provenance === "original");
    const summed = Object.values(media.originalReferencesByCitedWork).reduce((a, b) => a + b, 0);
    expect(summed).toBe(media.originalReferenceCount);
    for (const [work, count] of Object.entries(media.originalReferencesByCitedWork)) {
      expect(count).toBe(originals.filter((r) => r.cited_work === work).length);
    }
  });

  it("records a cited work on every eligible reference", () => {
    expect(rawMedia.filter((r) => r.cited_work === null)).toHaveLength(0);
  });
});

describe("real dataset — project metadata", () => {
  it("loads project metadata with the required disclaimer", () => {
    const project = getProjectMetadata();
    expect(project.disclaimer).toMatch(/independent/i);
    expect(project.repository_url).toBe("https://github.com/0xFlimbo/attention-index");
  });
});

describe("real dataset — derived last-update dates (docs/DATA.md §10)", () => {
  const posts = getPosts();
  const amplifications = getAmplifications();
  const mediaReferences = getMediaReferences();
  const observationDate = latestObservationDate(posts);
  const updatedDate = dataLastUpdated(posts, amplifications, mediaReferences);

  it("is non-null on a dataset that holds verified records", () => {
    expect(rawPosts.length).toBeGreaterThan(0);
    expect(observationDate).not.toBeNull();
    expect(updatedDate).not.toBeNull();
  });

  it("is a well-formed ISO date", () => {
    expect(observationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is never earlier than the date of the headline views figure", () => {
    // dataLastUpdated is the later of latestObservationDate and every
    // verified_at across all three files — it can equal it, never precede it.
    expect(updatedDate! >= observationDate!).toBe(true);
  });
});
