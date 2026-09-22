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
    cited_work: "none",
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
    cited_work: "none",
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

describe("mediaSchema — the cited work (B16)", () => {
  it("accepts an undetermined cited work on a needs_review record", () => {
    const result = mediaSchema.safeParse(
      validMedia({
        status: "needs_review",
        verified_at: null,
        provenance: null,
        cited_work: null,
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a verified record with no cited work — a read article has a known answer", () => {
    const result = mediaSchema.safeParse(validMedia({ cited_work: null }));
    expect(result.success).toBe(false);
  });

  it('accepts "none" on a verified record — the piece used no named work', () => {
    expect(mediaSchema.safeParse(validMedia({ cited_work: "none" })).success).toBe(true);
  });

  it("rejects a cited work outside the enum — free text does not aggregate", () => {
    const result = mediaSchema.safeParse(validMedia({ cited_work: "flagship product" }));
    expect(result.success).toBe(false);
  });
});

describe("getMediaMetrics — the cited-work split (B16)", () => {
  const references = [
    makeMediaReference({
      id: "media-a",
      publication: "Newsweek",
      published_at: "2026-01-01",
      cited_work: "h1b_data",
    }),
    makeMediaReference({
      id: "media-b",
      publication: "IBTimes UK",
      published_at: "2026-01-02",
      cited_work: "layoff_data",
    }),
    makeMediaReference({
      id: "media-c",
      publication: "The UNN",
      published_at: "2026-01-03",
      cited_work: "investigation",
    }),
    makeMediaReference({
      id: "media-d",
      publication: "HappyGamer",
      published_at: "2026-01-04",
      cited_work: "none",
    }),
    // A republication of the Newsweek piece: same work, second page.
    makeMediaReference({
      id: "media-e",
      publication: "Inkl",
      published_at: "2026-01-05",
      provenance: "syndicated",
      syndicated_from: "Newsweek",
      cited_work: "h1b_data",
    }),
    makeMediaReference({
      id: "media-f",
      publication: "Hidden Press",
      published_at: "2026-01-06",
      status: "needs_review",
      verified_at: null,
      provenance: null,
      cited_work: null,
    }),
  ];
  const metrics = getMediaMetrics(references);

  it("counts the cited work over original references only", () => {
    // media-e cites the same H-1B data as media-a, but it is the same piece
    // travelling — counting it would report one newsroom's use as two.
    expect(metrics.originalReferencesByCitedWork).toEqual({
      h1b_data: 1,
      layoff_data: 1,
      investigation: 1,
      none: 1,
    });
  });

  it("splits the original count exactly — every enum member is a bucket", () => {
    const total = Object.values(metrics.originalReferencesByCitedWork).reduce((a, b) => a + b, 0);
    expect(total).toBe(metrics.originalReferenceCount);
  });

  it("keeps a zero for a work nothing cites rather than dropping the key", () => {
    const onlyNone = getMediaMetrics([
      makeMediaReference({ id: "media-z", publication: "Z", published_at: "2026-01-01" }),
    ]);
    expect(onlyNone.originalReferencesByCitedWork).toEqual({
      h1b_data: 0,
      layoff_data: 0,
      investigation: 0,
      none: 1,
    });
  });

  it("returns a zeroed split for an empty dataset", () => {
    expect(getMediaMetrics([]).originalReferencesByCitedWork).toEqual({
      h1b_data: 0,
      layoff_data: 0,
      investigation: 0,
      none: 0,
    });
  });
});

describe("selectPublicationReferences — prominence by ordering", () => {
  /*
   * B19 revised these keys: the printed reference count is now key 1, above
   * provenance and featured. The two assertions below were written at B13
   * against the old order and are updated on purpose — provenance still
   * carries prominence, but inside a tie in the printed number rather than
   * above it. The reasoning lives in `selectPublicationReferences` and in
   * docs/DATA.md §11.
   */
  it("puts a publication with its own reporting above one that only republished, at an equal reference count", () => {
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
      makeMediaReference({ id: "media-d", publication: "Townhall", published_at: "2026-01-02" }),
    ]);
    // Both print "2 references", so the rail stays sorted either way and the
    // provenance key is free to decide: Townhall reported, Inkl republished,
    // and Inkl's fresher date does not buy back the distinction.
    expect(groups.map((group) => group.publication)).toEqual(["Townhall", "Inkl"]);
    expect(groups[1]?.references).toHaveLength(2);
  });

  it("does not let provenance reorder the printed reference count", () => {
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
    // The defect B19 exists to fix, at its smallest: a row printing
    // "2 references" must not sit below a row printing "1 reference".
    expect(groups.map((group) => group.publication)).toEqual(["Inkl", "Townhall"]);
    expect(groups.map((group) => group.references.length)).toEqual([2, 1]);
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

  it("does not let featured outrank a larger reference count", () => {
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

  /*
   * Converted from literals at B10 (docs/WORKPLAN.md, "value-pinned tests").
   * It pinned `94 / 77 / 17 / 33 / 7`, so B10's first media record turned the
   * suite red. The literals live on in `tests/frozen-dataset.test.ts` against the
   * frozen 2026-09-20 fixture; what belongs here is the arithmetic that has to
   * hold whatever the dataset grows to.
   *
   * The relationship that actually matters is the provenance split: every
   * verified record is either an original or a republication, and the two
   * partition the total exactly. That is the claim `docs/DATA.md §7` makes and
   * the one a per-publication count depends on — a record drifting to a third
   * state, or being counted in both, is the failure this file exists to catch.
   */
  it("splits every verified reference into exactly one of original or republication", () => {
    const metrics = getMediaMetrics(references);
    const verified = references.filter(
      (reference) => reference.status === "verified" && reference._placeholder !== true,
    );

    expect(metrics.verifiedMediaReferenceCount).toBe(verified.length);
    expect(metrics.originalReferenceCount + metrics.syndicatedReferenceCount).toBe(
      metrics.verifiedMediaReferenceCount,
    );
    expect(metrics.originalReferenceCount).toBe(
      verified.filter((reference) => reference.provenance === "original").length,
    );
    expect(metrics.syndicatedReferenceCount).toBe(
      verified.filter((reference) => reference.provenance === "syndicated").length,
    );
    expect(metrics.featuredReferenceCount).toBe(
      verified.filter((reference) => reference.featured).length,
    );
    expect(metrics.countryCount).toBe(
      new Set(
        verified
          .filter((reference) => reference.provenance === "original")
          .map((reference) => reference.country)
          .filter((country): country is string => country !== null),
      ).size,
    );
  });
});
