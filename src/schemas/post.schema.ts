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

/**
 * docs/DATA.md §5 — how a reading was taken. Precision follows from the
 * source and is therefore **not** a second field: a platform API returns
 * exact integers, while a public interface rounds above 1,000 (X prints
 * `427K` for 427,443). A `precision` field would be derivable from this one,
 * which is the stored summary the canonical rule bans.
 *
 * It is stored per observation rather than per post because one post can
 * legitimately hold readings of both kinds — a post seeded by hand before the
 * API could return it, then refreshed from the API afterwards.
 */
export const observationSourceEnum = z.enum(["api", "interface"]);

const postObservationSchema = z.object({
  views: nonNegativeInt,
  likes: nonNegativeInt.nullable(),
  reposts: nonNegativeInt.nullable(),
  replies: nonNegativeInt.nullable(),
  bookmarks: nonNegativeInt.nullable(),
  observed_at: isoDateString,
  source: observationSourceEnum,
});

/**
 * docs/DATA.md §5 — the append-only observation history (B18). A refresh adds
 * a reading, it never replaces one: a past reading of a public counter cannot
 * be re-taken, and discarding it throws away the only record that it was ever
 * that number on that day.
 *
 * `nonempty()` rather than a separate "at least one" check, so the type is
 * `[T, ...T[]]` and `observations[0]` is statically known to exist under
 * `noUncheckedIndexedAccess`.
 */
const postObservationsSchema = z
  .array(postObservationSchema)
  .nonempty("a post must carry at least one observation")
  .superRefine((observations, ctx) => {
    const seen = new Set<string>();
    observations.forEach((observation, index) => {
      // A unique `observed_at` is what makes "the latest observation" a single,
      // well-defined record. Two readings on one day are the one case where a
      // reading is genuinely redundant — same day, same public counter,
      // differing only in how it was read. If both must be kept, docs/DATA.md §2
      // already allows a full timestamp, which separates them.
      if (seen.has(observation.observed_at)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "observed_at"],
          message: `duplicate observation date "${observation.observed_at}" on the same post`,
        });
      }
      seen.add(observation.observed_at);

      // Chronological order is a readability rule, not a correctness one —
      // `latestObservation` takes the maximum rather than the last element, so
      // an out-of-order file would still compute correctly. It is validated
      // anyway: a hand-edit that appends in the wrong place should fail loudly
      // rather than leave the file's visual order lying about the history.
      const previous = observations[index - 1];
      if (previous !== undefined && observation.observed_at < previous.observed_at) {
        ctx.addIssue({
          code: "custom",
          path: [index, "observed_at"],
          message:
            `observations must be stored oldest first — "${observation.observed_at}" ` +
            `follows "${previous.observed_at}"`,
        });
      }
    });
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
    observations: postObservationsSchema,
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
export type PostObservation = z.infer<typeof postObservationSchema>;
export type ObservationSource = z.infer<typeof observationSourceEnum>;
