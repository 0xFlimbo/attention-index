import type { Amplification } from "@/schemas/amplification.schema";
import type { Post } from "@/schemas/post.schema";
import { AMPLIFICATION_ACTION_LABELS } from "@/lib/metrics/amplification";
import { formatCount } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { ExternalArrow } from "./external-arrow";

/**
 * docs/DESIGN.md §6 "Person / amplifier card" — one amplifier's data, already
 * shaped for display (same split as `ArchiveRow`/`toArchiveRowData`: field
 * selection and lookups happen in the mapper, formatting stays in the
 * component). `portrait` is deliberately not carried through — see the
 * component's comment.
 */
export interface AmplifierCardData {
  id: string;
  entityName: string;
  role: string | null;
  actionLabel: string;
  handle: string;
  date: string;
  relatedPostSubject: string | null;
  followerCount: number | null;
  followerCountObservedAt: string | null;
  evidenceUrl: string;
}

/**
 * `verifiedPostsById` is a lookup of *verified* posts only — a
 * `related_post_id` that points at a `needs_review`/`archived` post (or at
 * nothing, like `amp-ron-desantis-…`, whose quoted post isn't tracked) simply
 * resolves to `null` and the metadata line is omitted, never a broken link
 * to an unverified fact.
 */
export function toAmplifierCardData(
  amplification: Amplification,
  verifiedPostsById: ReadonlyMap<string, Post>,
  officialXAccount: string,
): AmplifierCardData {
  const relatedPost =
    amplification.related_post_id !== null
      ? (verifiedPostsById.get(amplification.related_post_id) ?? null)
      : null;

  return {
    id: amplification.id,
    entityName: amplification.entity_name,
    role: amplification.role,
    actionLabel: AMPLIFICATION_ACTION_LABELS[amplification.action],
    handle: officialXAccount,
    date: amplification.date,
    relatedPostSubject: relatedPost !== null ? (relatedPost.subject ?? relatedPost.title) : null,
    followerCount: amplification.follower_count,
    followerCountObservedAt: amplification.follower_count_observed_at,
    evidenceUrl: amplification.evidence_url,
  };
}

interface AmplifierCardProps {
  data: AmplifierCardData;
}

/**
 * docs/DESIGN.md §6 — text-first, explicitly "not a profile card": no
 * border-box, no rounded surface, no shadow, no avatar circle. A thin top
 * rule plus whitespace is the only structure.
 *
 * `portrait` is never rendered: every one of today's 10 records has
 * `portrait: null` (docs/DATA.md §6 keeps the field for later), so wiring up
 * an `<img>` path now would be dead code with nothing to exercise it — noted
 * as a deliberate deviation in the batch report, not an oversight.
 */
export function AmplifierCard({ data }: AmplifierCardProps) {
  return (
    <div className="amplifier-card border-t border-line-strong py-6">
      <p className="text-lg font-bold text-ink">{data.entityName}</p>
      {data.role !== null && <p className="text-metadata mt-1 text-ink-soft">{data.role}</p>}

      <div className="mt-5">
        <p className="text-metadata text-ink">
          {data.actionLabel} {data.handle}
        </p>
        <p className="text-metadata mt-1 text-ink-soft">{formatDate(data.date)}</p>
      </div>

      {/*
        Labelled, never a bare subject: "Trine University" sitting alone under a
        person's role reads as an affiliation, not as the tracked post they
        amplified. "Tracked post" is the site's own established vocabulary
        (docs/HOMEPAGE.md §6's `TRACKED POSTS` / `MOST VIEWED TRACKED POST`).
      */}
      {data.relatedPostSubject !== null && (
        <p className="text-sm mt-3 text-ink-soft">Tracked post: {data.relatedPostSubject}</p>
      )}

      {/* docs/EDITORIAL.md §5 — contextual only, always paired with its observation date, never framed as reach. */}
      {data.followerCount !== null && data.followerCountObservedAt !== null && (
        <p className="text-sm mt-3 text-ink-soft">
          {formatCount(data.followerCount)} followers observed {formatDate(data.followerCountObservedAt)}
        </p>
      )}

      <a
        href={data.evidenceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-metadata mt-5 inline-block font-bold text-ink underline-offset-2 hover:underline"
      >
        VIEW EVIDENCE <ExternalArrow /><span className="sr-only"> for {data.entityName}</span>
      </a>
    </div>
  );
}
