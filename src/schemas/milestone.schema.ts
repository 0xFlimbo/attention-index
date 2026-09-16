import { z } from "zod";
import {
  absoluteUrlString,
  idWithPrefix,
  isoDateString,
  placeholderFlag,
  applySharedRecordRules,
  statusEnum,
} from "./shared";

/** docs/DATA.md §8 */
export const milestoneCategoryEnum = z.enum([
  "attention",
  "crossover",
  "media",
  "politics",
  "project",
  "community",
  "other",
]);

// Required fields per docs/DATA.md §8: id, date, title, category, status. A milestone can
// be derived from records the site already holds, so evidence_url stays nullable; verified_at
// is nullable too but required once status is "verified" (shared rule).
export const milestoneSchema = z
  .object({
    id: idWithPrefix("milestone"),
    date: isoDateString,
    title: z.string().min(1),
    category: milestoneCategoryEnum,
    description: z.string().min(1).nullable(),
    evidence_url: absoluteUrlString.nullable(),
    related_post_id: z.string().nullable(),
    status: statusEnum,
    verified_at: isoDateString.nullable(),
    _placeholder: placeholderFlag,
  })
  .superRefine(applySharedRecordRules);

export const milestonesFileSchema = z.array(milestoneSchema).superRefine((milestones, ctx) => {
  const seen = new Set<string>();
  milestones.forEach((milestone, index) => {
    if (seen.has(milestone.id)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `duplicate milestone id "${milestone.id}"`,
      });
    }
    seen.add(milestone.id);
  });
});

export type Milestone = z.infer<typeof milestoneSchema>;
