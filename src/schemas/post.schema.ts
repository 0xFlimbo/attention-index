import { z } from "zod";
import {
  absoluteUrlString,
  idWithPrefix,
  isoDateString,
  nonNegativeInt,
  placeholderFlag,
  applySharedRecordRules,
  statusEnum,
} from "./shared";

/** docs/DATA.md §5 */
export const postPlatformEnum = z.enum(["x", "website", "youtube", "linkedin", "other"]);

const postMetricsSchema = z.object({
  views: nonNegativeInt,
  likes: nonNegativeInt.nullable(),
  reposts: nonNegativeInt.nullable(),
  replies: nonNegativeInt.nullable(),
  bookmarks: nonNegativeInt.nullable(),
  observed_at: isoDateString,
});

export const postSchema = z
  .object({
    id: idWithPrefix("post"),
    platform: postPlatformEnum,
    account: z.string().min(1),
    published_at: isoDateString,
    title: z.string().min(1),
    subject: z.string().min(1).nullable(),
    summary: z.string().min(1).nullable(),
    url: absoluteUrlString,
    status: statusEnum,
    featured: z.boolean(),
    tags: z.array(z.string().min(1)),
    metrics: postMetricsSchema,
    screenshot: z.string().min(1).nullable(),
    notes: z.string().min(1).nullable(),
    verified_at: isoDateString.nullable(),
    _placeholder: placeholderFlag,
  })
  .superRefine(applySharedRecordRules);

export const postsFileSchema = z.array(postSchema).superRefine((posts, ctx) => {
  const seen = new Set<string>();
  posts.forEach((post, index) => {
    if (seen.has(post.id)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `duplicate post id "${post.id}"`,
      });
    }
    seen.add(post.id);
  });
});

export type Post = z.infer<typeof postSchema>;
export type PostPlatform = z.infer<typeof postPlatformEnum>;
