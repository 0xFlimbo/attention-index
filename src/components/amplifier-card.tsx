import type { Amplification } from "@/schemas/amplification.schema";
import type { Post } from "@/schemas/post.schema";
import { AMPLIFICATION_ACTION_LABELS, type AmplifierGroup } from "@/lib/metrics/amplification";
import { formatCount } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { ExternalArrow } from "./external-arrow";

/** One act on a card — what was done, when, to which tracked post, and its proof. */
export interface AmplifierActData {
  id: string;
  actionLabel: string;
  date: string;
  relatedPostSubject: string | null;
  evidenceUrl: string;
}

/**
 * docs/DESIGN.md §6 "Person / amplifier card" — one amplifier's data, already
 * shaped for display (same split as `ArchiveRow`/`toArchiveRowData`: field
 * selection and lookups happen in the mapper, formatting stays in the
 * component). One card per person: `acts` holds every verified act of theirs,
 * newest first. `portrait` is deliberately not carried through — see the
 * component's comment.
 */
export interface AmplifierCardData {
  id: string;
  entityName: string;
  role: string | null;
  handle: string;
  acts: AmplifierActData[];
  followerCount: number | null;
  followerCountObservedAt: string | null;
}

/**
 * `verifiedPostsById` is a lookup of *verified* posts only — a
 * `related_post_id` that points at a `needs_review`/`archived` post (or at
 * nothing, like `amp-ron-desantis-…`, whose quoted post isn't tracked) simply
 * resolves to `null` and the metadata line is omitted, never a broken link
 * to an unverified fact.
 */
function toAmplifierActData(
  amplification: Amplification,
  verifiedPostsById: ReadonlyMap<string, Post>,
): AmplifierActData {
  const relatedPost =
    amplification.related_post_id !== null
      ? (verifiedPostsById.get(amplification.related_post_id) ?? null)
      : null;

  return {
    id: amplification.id,
    actionLabel: AMPLIFICATION_ACTION_LABELS[amplification.action],
    date: amplification.date,
    relatedPostSubject: relatedPost !== null ? (relatedPost.subject ?? relatedPost.title) : null,
    evidenceUrl: amplification.evidence_url,
  };
}

/**
 * Name, role and follower count come from the group's most recent act
 * (`records[0]`), which describes the person as they are now.
 *
 * The follower count is carried only for `public_figure`: that category is
 * the one a person can enter on audience size alone (docs/DATA.md §6), so the
 * number is the reason they are on the list. For an officeholder, a
 * journalist or an outlet the role is the point, and a number beside it would
 * read as a ranking.
 */
export function toAmplifierCardData(
  group: AmplifierGroup,
  verifiedPostsById: ReadonlyMap<string, Post>,
  officialXAccount: string,
): AmplifierCardData {
  const [latest] = group.records;
  if (latest === undefined) throw new Error(`Amplifier group ${group.identity} has no records`);
  const showsFollowers = latest.category === "public_figure";

  return {
    id: latest.id,
    entityName: latest.entity_name,
    role: latest.role,
    handle: officialXAccount,
    acts: group.records.map((record) => toAmplifierActData(record, verifiedPostsById)),
    followerCount: showsFollowers ? latest.follower_count : null,
    followerCountObservedAt: showsFollowers ? latest.follower_count_observed_at : null,
  };
}

interface AmplifierActProps {
  act: AmplifierActData;
  handle: string;
  evidenceLabel: string;
}

function AmplifierAct({ act, handle, evidenceLabel }: AmplifierActProps) {
  return (
    <>
      <div className="mt-5">
        <p className="text-metadata text-ink">
          {act.actionLabel} {handle}
        </p>
        <p className="text-metadata mt-1 text-ink-soft">{formatDate(act.date)}</p>
      </div>

      {/*
        Labelled, never a bare subject: "Trine University" sitting alone under a
        person's role reads as an affiliation, not as the tracked post they
        amplified. "Tracked post" is the site's own established vocabulary
        (docs/HOMEPAGE.md §6's `TRACKED POSTS` / `MOST VIEWED TRACKED POST`).
      */}
      {act.relatedPostSubject !== null && (
        <p className="text-sm mt-3 text-ink-soft">Tracked post: {act.relatedPostSubject}</p>
      )}

      <a
        href={act.evidenceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-metadata mt-5 inline-block font-bold text-ink underline-offset-2 hover:underline"
      >
        VIEW EVIDENCE <ExternalArrow /><span className="sr-only"> for {evidenceLabel}</span>
      </a>
    </>
  );
}

interface AmplifierCardProps {
  data: AmplifierCardData;
}

/**
 * docs/DESIGN.md §6 — text-first, explicitly "not a profile card": no
 * border-box, no rounded surface, no shadow, no avatar circle. A thin top
 * rule plus whitespace is the only structure.
 *
 * `portrait` is never rendered: every record has `portrait: null`
 * (docs/DATA.md §6 keeps the field for later), so wiring up an `<img>` path
 * now would be dead code with nothing to exercise it.
 *
 * A person with one act renders exactly as before. Several acts become a list,
 * and each evidence link's accessible name carries the act's date so the
 * links stay distinguishable to a screen reader.
 */
export function AmplifierCard({ data }: AmplifierCardProps) {
  const [onlyAct] = data.acts;

  return (
    <div className="amplifier-card border-t border-line-strong py-6">
      <p className="text-lg font-bold text-ink">{data.entityName}</p>
      {data.role !== null && <p className="text-metadata mt-1 text-ink-soft">{data.role}</p>}

      {/*
        docs/EDITORIAL.md §5 — contextual only, always paired with its observation
        date, never framed as reach. It describes the person, so it sits with the
        name rather than under any one act.
      */}
      {data.followerCount !== null && data.followerCountObservedAt !== null && (
        <p className="text-sm mt-1 text-ink-soft">
          {formatCount(data.followerCount)} followers observed {formatDate(data.followerCountObservedAt)}
        </p>
      )}

      {data.acts.length === 1 && onlyAct !== undefined ? (
        <AmplifierAct act={onlyAct} handle={data.handle} evidenceLabel={data.entityName} />
      ) : (
        <ul>
          {data.acts.map((act) => (
            <li key={act.id}>
              <AmplifierAct
                act={act}
                handle={data.handle}
                evidenceLabel={`${data.entityName}, ${formatDate(act.date)}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
