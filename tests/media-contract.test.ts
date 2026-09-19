import { describe, expect, it } from "vitest";
import { mediaSchema, type MediaReference } from "../src/schemas/media.schema";
import { getMediaMetrics, selectPublicationReferences } from "../src/lib/metrics/media";
import { getMediaReferences } from "../src/lib/data/media";
import { mediaReferenceDescriptors } from "../src/lib/format/media-descriptors";
import { formatCountry } from "../src/lib/format/country";
import { splitSyndicationSuffix } from "../src/lib/validation/publication-name";

/**
 * docs/WORKPLAN.md B13 — the media record contract: `country`, provenance and
 * the `featured` criterion. Covers the schema rules that keep the contract
 * from being broken by hand-editing, the derived figures that depend on it,
 * and the ordering that carries prominence without a badge.
 */

function validMedia(overrides: Record<string, unknown> = {}) {
  return {
    id: "media-example-2026-01-01",
    publication: "Example Publication",
    title: "Example article",
    reference_type: "article",
    published_at: "2026-01-01",
    url: "https://example.com/article",
    author: null,
    country: null,
    provenance: "original",
    syndicated_from: null,
    context: null,
    related_post_id: null,
    featured: false,
    logo: null,
    archive_url: null,
    notes: null,
    status: "verified",
    verified_at: "2026-01-02",
    ...overrides,
  };
}

function makeMediaReference(
  overrides: Partial<MediaReference> & { id: string; publication: string; published_at: string },
): MediaReference {
  return {
    title: "Test title",
    reference_type: "article",
    url: "https://example.com/article",
    author: null,
    country: null,
    provenance: "original",
    syndicated_from: null,
    context: null,
    related_post_id: null,
    featured: false,
    logo: null,
    archive_url: null,
    notes: null,
    status: "verified",
    verified_at: "2026-01-02",
    ...overrides,
  };
}

describe("mediaSchema — provenance", () => {
  it("accepts an undetermined provenance on a needs_review record", () => {
    const result = mediaSchema.safeParse(
      validMedia({ status: "needs_review", verified_at: null, provenance: null }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a verified record with no provenance — a read article has a known origin", () => {
    const result = mediaSchema.safeParse(validMedia({ provenance: null }));
    expect(result.success).toBe(false);
  });

  it("rejects a syndicated record that does not name the outlet it credits", () => {
    const result = mediaSchema.safeParse(
      validMedia({ provenance: "syndicated", syndicated_from: null }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects syndicated_from on a record marked original", () => {
    const result = mediaSchema.safeParse(validMedia({ syndicated_from: "IBTimes UK" }));
    expect(result.success).toBe(false);
  });

  it("rejects a record that credits itself as its own source", () => {
    const result = mediaSchema.safeParse(
      validMedia({ provenance: "syndicated", syndicated_from: "Example Publication" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a syndicated record naming a different publication", () => {
    const result = mediaSchema.safeParse(
      validMedia({ provenance: "syndicated", syndicated_from: "IBTimes UK" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("mediaSchema — the featured criterion", () => {
  it("rejects a featured record that has not been verified", () => {
    const result = mediaSchema.safeParse(
      validMedia({ featured: true, status: "needs_review", verified_at: null, provenance: null }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a featured republication — the criterion is about a publication's own reporting", () => {
    const result = mediaSchema.safeParse(
      validMedia({ featured: true, provenance: "syndicated", syndicated_from: "IBTimes UK" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a featured, verified, original record", () => {
    expect(mediaSchema.safeParse(validMedia({ featured: true })).success).toBe(true);
  });
});

describe("getMediaMetrics — the B13 counting rule", () => {
  const references = [
    makeMediaReference({
      id: "media-a",
      publication: "IBTimes UK",
      published_at: "2026-01-01",
      country: "GB",
    }),
    makeMediaReference({
      id: "media-b",
      publication: "Inkl",
      published_at: "2026-01-02",
      country: "AU",
      provenance: "syndicated",
      syndicated_from: "IBTimes UK",
    }),
    makeMediaReference({
      id: "media-c",
      publication: "Newsweek",
      published_at: "2026-01-03",
      country: "US",
      featured: true,
    }),
    makeMediaReference({
      id: "media-d",
      publication: "ZeroHedge",
      published_at: "2026-01-04",
      country: null,
    }),
    makeMediaReference({
      id: "media-e",
      publication: "Hidden Press",
      published_at: "2026-01-05",
      country: "IT",
      status: "needs_review",
      verified_at: null,
      provenance: null,
    }),
  ];
  const metrics = getMediaMetrics(references);

  it("counts every eligible record, republications included, as a record count", () => {
    expect(metrics.verifiedMediaReferenceCount).toBe(4);
    expect(metrics.uniquePublicationCount).toBe(4);
  });

  it("splits that total into original reporting and republications", () => {
    expect(metrics.originalReferenceCount).toBe(3);
    expect(metrics.syndicatedReferenceCount).toBe(1);
    expect(metrics.originalReferenceCount + metrics.syndicatedReferenceCount).toBe(
      metrics.verifiedMediaReferenceCount,
    );
  });

  it("counts countries over original records only — a republisher's country reported nothing", () => {
    expect(metrics.referencesByCountry).toEqual({ GB: 1, US: 1 });
    expect(metrics.countryCount).toBe(2);
  });

  it("counts no country for a record whose newsroom country is unknown", () => {
    expect(metrics.referencesByCountry["AU"]).toBeUndefined();
    expect(Object.values(metrics.referencesByCountry).reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("counts featured references over eligible records only", () => {
    expect(metrics.featuredReferenceCount).toBe(1);
  });

  it("returns zeroed figures for an empty dataset", () => {
    const empty = getMediaMetrics([]);
    expect(empty.originalReferenceCount).toBe(0);
    expect(empty.syndicatedReferenceCount).toBe(0);
    expect(empty.featuredReferenceCount).toBe(0);
    expect(empty.countryCount).toBe(0);
    expect(empty.referencesByCountry).toEqual({});
  });
});

describe("selectPublicationReferences — prominence by ordering", () => {
  it("puts a publication with its own reporting above one that only republished", () => {
    const groups = selectPublicationReferences([
      makeMediaReference({
        id: "media-a",
        publication: "Inkl",
        published_at: "2026-05-01",
        provenance: "syndicated",
        syndicated_from: "IBTimes UK",
      }),
      makeMediaReference({
        id: "media-b",
        publication: "Inkl",
        published_at: "2026-05-02",
        provenance: "syndicated",
        syndicated_from: "IBTimes UK",
      }),
      makeMediaReference({ id: "media-c", publication: "Townhall", published_at: "2026-01-01" }),
    ]);
    // Inkl has more records and a fresher date and still sorts last: two
    // republications of someone else's piece are not two acts of coverage.
    expect(groups.map((group) => group.publication)).toEqual(["Townhall", "Inkl"]);
    expect(groups[1]?.references).toHaveLength(2);
  });

  it("breaks an equal original count by featured count", () => {
    const groups = selectPublicationReferences([
      makeMediaReference({ id: "media-a", publication: "Alpha Press", published_at: "2026-05-01" }),
      makeMediaReference({
        id: "media-b",
        publication: "Zeta Media",
        published_at: "2026-01-01",
        featured: true,
      }),
    ]);
    // Zeta Media loses on both date and name and still leads on the flag.
    expect(groups.map((group) => group.publication)).toEqual(["Zeta Media", "Alpha Press"]);
  });

  it("does not let featured outrank a larger original count", () => {
    const groups = selectPublicationReferences([
      makeMediaReference({
        id: "media-a",
        publication: "Alpha Press",
        published_at: "2026-05-01",
        featured: true,
      }),
      makeMediaReference({ id: "media-b", publication: "Zeta Media", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-c", publication: "Zeta Media", published_at: "2026-01-02" }),
    ]);
    // The row prints its reference count, so the printed number stays sorted.
    expect(groups.map((group) => group.publication)).toEqual(["Zeta Media", "Alpha Press"]);
  });

  it("exposes each group's derived original and featured counts", () => {
    const groups = selectPublicationReferences([
      makeMediaReference({
        id: "media-a",
        publication: "Newsweek",
        published_at: "2026-01-01",
        featured: true,
      }),
      makeMediaReference({ id: "media-b", publication: "Newsweek", published_at: "2026-01-02" }),
    ]);
    expect(groups[0]).toMatchObject({
      publication: "Newsweek",
      originalCount: 2,
      featuredCount: 1,
    });
  });
});

describe("mediaReferenceDescriptors", () => {
  it("says nothing when there is nothing factual to say", () => {
    expect(
      mediaReferenceDescriptors(
        makeMediaReference({ id: "media-a", publication: "Townhall", published_at: "2026-01-01" }),
      ),
    ).toEqual([]);
  });

  it("names the credited outlet for a republication", () => {
    expect(
      mediaReferenceDescriptors(
        makeMediaReference({
          id: "media-a",
          publication: "The Gateway Pundit",
          published_at: "2026-01-01",
          country: "US",
          provenance: "syndicated",
          syndicated_from: "Western Journal",
        }),
      ),
    ).toEqual(["United States", "Republished from Western Journal"]);
  });

  it("states the featured criterion instead of printing the flag", () => {
    expect(
      mediaReferenceDescriptors(
        makeMediaReference({
          id: "media-b",
          publication: "Newsweek",
          published_at: "2026-01-01",
          country: "US",
          featured: true,
        }),
      ),
    ).toEqual(["United States", "Names LayoffHedge as a source"]);
  });
});

describe("formatCountry", () => {
  it("resolves the codes the dataset uses", () => {
    expect(formatCountry("GB")).toBe("United Kingdom");
    expect(formatCountry("IN")).toBe("India");
    expect(formatCountry("CA")).toBe("Canada");
  });

  it("falls back to the code rather than inventing a name", () => {
    expect(formatCountry("ZZ")).toBe("ZZ");
  });
});

describe("splitSyndicationSuffix — the importer never writes provenance into a name", () => {
  it("splits a press-page label of the form 'Inkl (via IBTimes UK)'", () => {
    expect(splitSyndicationSuffix("Inkl (via IBTimes UK)")).toEqual({
      publication: "Inkl",
      syndicatedFrom: "IBTimes UK",
    });
  });

  it("leaves a plain outlet name alone, including a non-'via' parenthetical", () => {
    expect(splitSyndicationSuffix("Forbes (Digital Assets)")).toEqual({
      publication: "Forbes (Digital Assets)",
      syndicatedFrom: null,
    });
  });

  it("refuses a suffix that repeats the publication", () => {
    expect(splitSyndicationSuffix("Inkl (via Inkl)")).toEqual({
      publication: "Inkl (via Inkl)",
      syndicatedFrom: null,
    });
  });
});

describe("media contract — real dataset", () => {
  const references = getMediaReferences();

  it("leaves no publication name carrying a '(via …)' provenance suffix", () => {
    expect(references.filter((reference) => /\(via\s/i.test(reference.publication))).toEqual([]);
  });

  it("gives every verified record a provenance, and every featured record both flags", () => {
    for (const reference of references.filter((ref) => ref.status === "verified")) {
      expect(reference.provenance).not.toBeNull();
    }
    for (const reference of references.filter((ref) => ref.featured)) {
      expect(reference.status).toBe("verified");
      expect(reference.provenance).toBe("original");
    }
  });

  it("matches today's reading: 18 verified — 17 original, 1 republication — across 4 countries", () => {
    const metrics = getMediaMetrics(references);
    expect(metrics.verifiedMediaReferenceCount).toBe(18);
    expect(metrics.originalReferenceCount).toBe(17);
    expect(metrics.syndicatedReferenceCount).toBe(1);
    expect(metrics.featuredReferenceCount).toBe(8);
    expect(metrics.countryCount).toBe(4);
  });
});
