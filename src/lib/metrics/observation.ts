import type { Post, PostObservation } from "@/schemas/post.schema";

/**
 * docs/DATA.md §5, §10 — the one agreed reading of a post.
 *
 * Every derived metric reads exactly one observation per post, and this is
 * the function that picks it: the most recent `observed_at`. The schema
 * guarantees the array is non-empty and that `observed_at` is unique within a
 * post, so "the latest" is always a single, well-defined record and this
 * never has to break a tie.
 *
 * It takes the maximum rather than the last element on purpose. The file
 * stores observations oldest-first and validation enforces that, but a
 * selector that depended on array order would silently return the wrong
 * reading if that order were ever broken — here an out-of-order file is a
 * validation failure, not a wrong headline number.
 *
 * **What this deliberately does not do: prefer a source.** A reading from a
 * public interface is rounded (X prints `427K` for 427,443) and one from an
 * API is exact, so a later interface reading can sit *below* an earlier API
 * one. That is not a decline and the site never claims otherwise — a view
 * count here is an observation paired with a date, never a growth curve, and
 * "427K observed on Sep 19 2026" stays true. Preferring the API reading
 * instead would mean publishing a figure that is not the most recent one, on
 * a judgement this project has no basis for. What must never happen is a
 * *series* drawn across mixed sources; `source` is stored on every
 * observation precisely so any future consumer can filter for one kind.
 */
export function latestObservation(post: Post): PostObservation {
  return post.observations.reduce((latest, candidate) =>
    candidate.observed_at > latest.observed_at ? candidate : latest,
  );
}
