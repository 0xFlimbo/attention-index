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
  .superRefine(applySharedRecordRules);

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
