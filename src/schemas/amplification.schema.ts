import { z } from "zod";
import {
  absoluteUrlString,
  countryCode,
  idWithPrefix,
  isoDateString,
  nonNegativeInt,
  placeholderFlag,
  applySharedRecordRules,
  statusEnum,
} from "./shared";

/** docs/DATA.md §6 */
export const entityTypeEnum = z.enum(["person", "organization"]);

export const amplificationCategoryEnum = z.enum([
  "government",
  "politics",
  "journalism",
  "media",
  "business",
  "tech",
  "public_figure",
  "other",
]);

export const amplificationActionEnum = z.enum([
  "repost",
  "quote_post",
  "reply",
  "mention",
  "share",
  "citation",
  "interview",
  "other",
]);

export const amplificationPlatformEnum = z.enum(["x", "website", "youtube", "linkedin", "other"]);

export const amplificationSchema = z
  .object({
    id: idWithPrefix("amp"),
    entity_type: entityTypeEnum,
    entity_name: z.string().min(1),
    role: z.string().min(1).nullable(),
    organization: z.string().min(1).nullable(),
    category: amplificationCategoryEnum,
    action: amplificationActionEnum,
    date: isoDateString,
    // Not in the docs/DATA.md §6 required-field list — nullable like role/organization.
    platform: amplificationPlatformEnum.nullable(),
    account: z.string().min(1).nullable(),
    evidence_url: absoluteUrlString,
    related_post_id: z.string().nullable(),
    // Real records in data/amplifications.json omit these keys entirely rather than
    // setting them to null (a deviation from docs/DATA.md §2's "use null, never omit"
    // convention — flagged in the B1 report). Accept both shapes and normalize to null
    // so downstream code only ever sees `number | null`, never `undefined`.
    follower_count: nonNegativeInt.nullish().transform((value) => value ?? null),
    follower_count_observed_at: isoDateString.nullish().transform((value) => value ?? null),
    country: countryCode.nullable(),
    featured: z.boolean(),
    portrait: z.string().min(1).nullable(),
    notes: z.string().min(1).nullable(),
    status: statusEnum,
    verified_at: isoDateString.nullable(),
    _placeholder: placeholderFlag,
  })
  .superRefine((data, ctx) => {
    applySharedRecordRules(data, ctx);
    // docs/DATA.md §6 — "never without follower_count_observed_at"
    if (data.follower_count !== null && data.follower_count_observed_at === null) {
      ctx.addIssue({
        code: "custom",
        path: ["follower_count_observed_at"],
        message: "follower_count_observed_at is required when follower_count is present",
      });
    }
  });

export const amplificationsFileSchema = z.array(amplificationSchema).superRefine((amps, ctx) => {
  const seen = new Set<string>();
  amps.forEach((amp, index) => {
    if (seen.has(amp.id)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `duplicate amplification id "${amp.id}"`,
      });
    }
    seen.add(amp.id);
  });
});

export type Amplification = z.infer<typeof amplificationSchema>;
export type AmplificationCategory = z.infer<typeof amplificationCategoryEnum>;
