import { z } from "zod";
import {
  absoluteUrlString,
  countryCode,
  idWithPrefix,
  isoDateString,
  placeholderFlag,
  applySharedRecordRules,
  statusEnum,
} from "./shared";

/** docs/DATA.md §7 */
export const mediaReferenceTypeEnum = z.enum([
  "article",
  "newsletter",
  "podcast",
  "broadcast",
  "research",
  "blog",
  "other",
]);

/**
 * docs/DATA.md §7 — provenance is a **fact about the piece**, never a quality
 * judgement: `syndicated` means the piece itself credits another outlet as the
 * source of the reporting it carries. `null` means "not determined yet", the
 * same contract `verified_at` uses, and it is closed off for `verified`
 * records by `requireProvenanceWhenVerified` below.
 */
export const mediaProvenanceEnum = z.enum(["original", "syndicated"]);

/**
 * docs/DATA.md §7 — which of the official project's works the piece used, as
 * an attribute of a record that already exists. It is
 * never the subject of a record: nothing here describes a work, it only says
 * which one a reference drew on.
 *
 * The members are the works this dataset has evidence of, not a catalogue of
 * what the project ships:
 *   - `layoff_data`   the layoff dataset and its layoffhedge.com surfaces —
 *                     company and industry pages, monthly and year-to-date
 *                     totals, headcount estimates attributed to the site.
 *   - `h1b_data`      the H-1B / LCA / USCIS visa data and the surfaces built
 *                     on it — the congressional district map, the ZIP-code
 *                     lookup, employer rankings, renewal-approval analyses.
 *   - `investigation` an original investigation the project published.
 *   - `none`          **the conservative default**, and the same kind of value
 *                     as `featured: false`: the record does not show the piece
 *                     using a named work. What it describes is an @LayoffAI
 *                     post, a quotation, or the project named as a source. It
 *                     is a determination, not an absence of one, which is why
 *                     it is an enum member and not `null`.
 *
 * `null` means "not determined yet", the contract `provenance` and
 * `verified_at` already use, and is closed off for `verified` records by
 * `requireCitedWorkWhenVerified` below.
 *
 * Closed on purpose: free text does not aggregate, so a new member is a
 * deliberate edit here and in `docs/DATA.md §7` when the evidence for one
 * appears in the records — never a value invented inside a record.
 */
export const mediaCitedWorkEnum = z.enum([
  "layoff_data",
  "h1b_data",
  "investigation",
  "none",
]);

export const mediaSchema = z
  .object({
    id: idWithPrefix("media"),
    publication: z.string().min(1),
    title: z.string().min(1),
    reference_type: mediaReferenceTypeEnum,
    published_at: isoDateString,
    url: absoluteUrlString,
    author: z.string().min(1).nullable(),
    country: countryCode.nullable(),
    provenance: mediaProvenanceEnum.nullable(),
    syndicated_from: z.string().min(1).nullable(),
    cited_work: mediaCitedWorkEnum.nullable(),
    context: z.string().min(1).nullable(),
    related_post_id: z.string().nullable(),
    featured: z.boolean(),
    logo: z.string().min(1).nullable(),
    archive_url: absoluteUrlString.nullable(),
    notes: z.string().min(1).nullable(),
    status: statusEnum,
    verified_at: isoDateString.nullable(),
    _placeholder: placeholderFlag,
  })
  .superRefine((data, ctx) => {
    applySharedRecordRules(data, ctx);
    requireProvenanceWhenVerified(data, ctx);
    requireCitedWorkWhenVerified(data, ctx);
    requireSyndicationSource(data, ctx);
    requireFeaturedIsVerifiedOriginal(data, ctx);
  });

/**
 * docs/DATA.md §12 — a `verified` record has had its article read, so its
 * provenance is known by definition. Leaving it `null` on a verified record
 * would let a syndication enter the derived original-reporting figures
 * unnoticed, which is the inflation this constraint exists to close.
 */
function requireProvenanceWhenVerified(
  data: { status: string; provenance: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.status === "verified" && data.provenance === null) {
    ctx.addIssue({
      code: "custom",
      path: ["provenance"],
      message: 'verified records must record provenance ("original" or "syndicated")',
    });
  }
}

/**
 * docs/DATA.md §7 — a `verified` record has had its article read, so what the
 * piece used is known: either a named work or nothing beyond the post, which
 * is `"none"`. Leaving it `null` on a verified record would put it outside
 * every bucket of the derived split while looking like an unread record, and
 * the split's whole claim is that it is complete over the records it covers.
 */
function requireCitedWorkWhenVerified(
  data: { status: string; cited_work: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.status === "verified" && data.cited_work === null) {
    ctx.addIssue({
      code: "custom",
      path: ["cited_work"],
      message:
        'verified records must record a cited work ("none" when the piece used no named work)',
    });
  }
}

/**
 * `syndicated_from` names the outlet the piece itself credits. It is required
 * exactly when the record is syndicated and forbidden otherwise, so the two
 * fields can never disagree. It is a publication **name**, not a record id:
 * the crediting is a fact about the article whether or not the original piece
 * happens to be in this dataset.
 */
function requireSyndicationSource(
  data: { publication: string; provenance: string | null; syndicated_from: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.provenance === "syndicated" && data.syndicated_from === null) {
    ctx.addIssue({
      code: "custom",
      path: ["syndicated_from"],
      message: "syndicated records must name the publication they credit as the source",
    });
  }
  if (data.provenance !== "syndicated" && data.syndicated_from !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["syndicated_from"],
      message: 'syndicated_from is only allowed when provenance is "syndicated"',
    });
  }
  if (data.syndicated_from !== null && data.syndicated_from === data.publication) {
    ctx.addIssue({
      code: "custom",
      path: ["syndicated_from"],
      message: "syndicated_from must name a different publication",
    });
  }
}

/**
 * docs/DATA.md §7 and the criterion published on `/methodology`: `featured` is
 * declared curation over records this project has actually checked, and the
 * criterion is about a publication's **own** reporting. Both halves are
 * enforced here rather than left to editorial discipline, so the flag cannot
 * be set on an unread record or on a republication of someone else's piece.
 */
function requireFeaturedIsVerifiedOriginal(
  data: { featured: boolean; status: string; provenance: string | null },
  ctx: z.RefinementCtx,
) {
  if (!data.featured) return;
  if (data.status !== "verified") {
    ctx.addIssue({
      code: "custom",
      path: ["featured"],
      message: "only verified records may be featured",
    });
  }
  if (data.provenance !== "original") {
    ctx.addIssue({
      code: "custom",
      path: ["featured"],
      message: 'only records with provenance "original" may be featured',
    });
  }
}

export const mediaFileSchema = z.array(mediaSchema).superRefine((refs, ctx) => {
  const seen = new Set<string>();
  refs.forEach((ref, index) => {
    if (seen.has(ref.id)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `duplicate media id "${ref.id}"`,
      });
    }
    seen.add(ref.id);
  });
});

export type MediaReference = z.infer<typeof mediaSchema>;
export type MediaReferenceType = z.infer<typeof mediaReferenceTypeEnum>;
export type MediaProvenance = z.infer<typeof mediaProvenanceEnum>;
export type MediaCitedWork = z.infer<typeof mediaCitedWorkEnum>;
