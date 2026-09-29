/**
 * Which paid posts are acts on the measured project, and by whom.
 *
 * Pure, like `profile-store.ts`: the script walks `research/`, this decides.
 *
 * `docs/DATA.md §6` puts the act first — no act, no record — so a profile
 * review that cannot say whether an account ever quoted, replied to or named
 * the project hands a human accounts that can never become records. The 2026-09-27
 * re-screen made that join by hand over 978 paid posts; this is the same join,
 * kept so it can be re-run after every sweep.
 *
 * It reports what the paid data shows, never what an account did not do: an
 * account with no act here may well have acted in a post nobody paid to read.
 */
import { SELF_ACCOUNTS } from "./quote-candidates";

/** The fields this project reads off a post. */
export interface PaidPost {
  id: string;
  author_id: string;
  /** Cut at 280 characters on a long post; the whole text is in the note field. */
  text: string;
  /** The legacy and the current name of the same long-text field (docs/PROVIDERS.md). */
  note_tweet?: { text?: string };
  note_post?: { text?: string };
  created_at?: string;
  referenced_tweets?: { type: string; id: string }[];
  entities?: { urls?: { expanded_url?: string }[] };
}

export type ActKind = "quote_post" | "reply" | "mention";

/** The handle, or the brand in either spelling. The domain contains the brand. */
const NAMES_PROJECT = /@layoffai\b|layoff\s?hedge/i;
/** A stored search query that was looking for the project. */
const NAMES_PROJECT_QUERY = /layoffai|layoffhedge/i;

export interface ProjectAct {
  kind: ActKind;
  postId: string;
  authorId: string;
  /** `YYYY-MM-DD`, when the post carries a creation time. */
  date: string | null;
  /** The project post this act points at, for a quote or a reply. */
  targetId: string | null;
}

/**
 * Every post object anywhere in a parsed JSON value, recognised by carrying a
 * string `id`, `text` and `author_id`. A post read without `author_id` cannot
 * be attributed to anyone, so it is not an act this review can use.
 */
export function collectPostObjects(value: unknown, { skipIncludes = false } = {}): PaidPost[] {
  const found: PaidPost[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (
      typeof record.id === "string" &&
      typeof record.text === "string" &&
      typeof record.author_id === "string"
    ) {
      found.push(record as unknown as PaidPost);
    }
    // A post can carry nested posts (a sweep report's candidate list does), so
    // unlike a profile it is descended into.
    for (const [key, nested] of Object.entries(record)) {
      if (skipIncludes && key === "includes") continue;
      visit(nested);
    }
  };
  visit(value);
  return found;
}

/**
 * Whether a research file is the output of a search for the project itself —
 * Track A, whose query is the handle, the brand or the domain. Every result
 * such a search returned names the project, **including the ones whose text
 * shows only a t.co link**: `url:"layoffhedge.com"` matched the expanded URL,
 * which the response did not carry. Brad Carson's and Jason Chaffetz's
 * recorded acts are exactly that case, and a text test alone misses both.
 *
 * Recognised by what the file says about itself: a stored `query` naming the
 * project, a raw archive entry whose `endpoint` is a search, or the `track-a-`
 * prefix the Track A working files were given before the archive existed.
 */
export function isProjectSearchFile(label: string, parsed: unknown): boolean {
  if (/(^|\/)track-a-/.test(label)) return true;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const record = parsed as Record<string, unknown>;
  if (typeof record.query === "string" && NAMES_PROJECT_QUERY.test(record.query)) return true;
  return typeof record.endpoint === "string" && /\/tweets\/search\//.test(record.endpoint);
}

/**
 * The ids a project search returned as results. `includes` is skipped: in a
 * search response it holds the posts the results *quoted*, which did not match
 * the query themselves.
 */
export function projectSearchMatchIds(parsed: unknown): Set<string> {
  return new Set(collectPostObjects(parsed, { skipIncludes: true }).map((post) => post.id));
}

/** Account ids of the project itself, resolved from the paid profiles. */
export function selfAuthorIds(profiles: Iterable<{ id: string; username: string }>): Set<string> {
  const self = new Set<string>();
  for (const profile of profiles) {
    if (SELF_ACCOUNTS.includes(`@${profile.username.toLowerCase()}`)) self.add(profile.id);
  }
  return self;
}

/**
 * Every post id that belongs to the project: the tracked posts, plus any paid
 * post authored by the project's own accounts. The second set matters because
 * an account can quote a @LayoffAI post that was not tracked yet — two of the
 * acts the maintainer brought on 2026-09-27 were exactly that.
 */
export function projectPostIds(
  trackedStatusIds: Iterable<string>,
  posts: readonly PaidPost[],
  selfIds: ReadonlySet<string>,
): Set<string> {
  const ids = new Set(trackedStatusIds);
  for (const post of posts) if (selfIds.has(post.author_id)) ids.add(post.id);
  return ids;
}

/** The whole text of a post, long form first. */
function fullText(post: PaidPost): string {
  return post.note_tweet?.text ?? post.note_post?.text ?? post.text;
}

/**
 * The act a post is, or `null`. One post is one act: a quote that also types
 * the handle is a quote, not a quote and a mention.
 *
 * `searchMatchIds` are posts a project search returned (`isProjectSearchFile`):
 * they are mentions even when nothing in the stored text shows it.
 */
export function classifyAct(
  post: PaidPost,
  projectIds: ReadonlySet<string>,
  selfIds: ReadonlySet<string>,
  searchMatchIds: ReadonlySet<string> = new Set(),
): ProjectAct | null {
  if (selfIds.has(post.author_id)) return null;

  const references = post.referenced_tweets ?? [];
  const quoted = references.find((ref) => ref.type === "quoted" && projectIds.has(ref.id));
  const repliedTo = references.find((ref) => ref.type === "replied_to" && projectIds.has(ref.id));
  const linksDomain = (post.entities?.urls ?? []).some((url) =>
    /layoffhedge\.com/i.test(url.expanded_url ?? ""),
  );
  const mentions = NAMES_PROJECT.test(fullText(post)) || linksDomain || searchMatchIds.has(post.id);

  const kind: ActKind | null = quoted
    ? "quote_post"
    : repliedTo
      ? "reply"
      : mentions
        ? "mention"
        : null;
  if (!kind) return null;

  return {
    kind,
    postId: post.id,
    authorId: post.author_id,
    date: post.created_at ? post.created_at.slice(0, 10) : null,
    targetId: (quoted ?? repliedTo)?.id ?? null,
  };
}

/**
 * Acts grouped by author id, each author's acts oldest first, one per post.
 *
 * The same post is often stored several times — once truncated by a search,
 * once in full by a later lookup — so every copy is classified and the first
 * that is an act wins, rather than whichever copy happened to be read first.
 */
export function actsByAuthor(
  posts: readonly PaidPost[],
  projectIds: ReadonlySet<string>,
  selfIds: ReadonlySet<string>,
  searchMatchIds: ReadonlySet<string> = new Set(),
): Map<string, ProjectAct[]> {
  const seen = new Set<string>();
  const byAuthor = new Map<string, ProjectAct[]>();
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    const act = classifyAct(post, projectIds, selfIds, searchMatchIds);
    if (!act) continue;
    seen.add(post.id);
    const list = byAuthor.get(act.authorId) ?? [];
    list.push(act);
    byAuthor.set(act.authorId, list);
  }
  for (const list of byAuthor.values()) {
    list.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }
  return byAuthor;
}

/** The URL a reader opens to see the act. */
export function actEvidenceUrl(username: string, postId: string): string {
  return `https://x.com/${username}/status/${postId}`;
}

/** The fields of an amplification record this module reads. */
export interface RecordedAct {
  entity_name: string;
  account?: string | null;
  evidence_url: string;
  notes?: string | null;
  related_post_id?: string | null;
}

/**
 * The status ids a person's records already account for: each record's
 * evidence URL, and every status id its notes cite — an edit, a second
 * account, a post read and archived. Citing the id in `notes` is how a post
 * that was ruled on stops being reported as new.
 */
export function recordedStatusIds(records: readonly RecordedAct[]): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    for (const match of `${record.evidence_url} ${record.notes ?? ""}`.matchAll(/\d{15,}/g)) {
      ids.add(match[0]);
    }
  }
  return ids;
}

export interface UnaccountedAct {
  entityName: string;
  username: string;
  act: ProjectAct;
  /**
   * The act points at a post one of this person's records already covers: one
   * act, extra evidence for that record's notes (docs/DATA.md §6). Otherwise it
   * is a candidate for a record of its own.
   */
  samePost: boolean;
}

/** The handle a record acted from, lower-cased: `account` first, the evidence URL second. */
function recordHandle(record: RecordedAct): string | null {
  const handle =
    record.account?.replace(/^@/, "") ??
    record.evidence_url.match(/(?:x|twitter)\.com\/([^/?#]+)\/status\//i)?.[1];
  return handle ? handle.toLowerCase() : null;
}

/**
 * Acts in paid data by accounts already recorded, which no record of that
 * person accounts for.
 *
 * The screening tools drop recorded accounts, because a recorded person is not
 * a candidate. But "one act, one record" makes a recorded person's act on
 * another post a record of its own, and without this nothing reports it. Grouped
 * by person, so an act from a second account of the same person is checked
 * against every record of theirs.
 */
export function unaccountedActs(
  records: readonly RecordedAct[],
  acts: ReadonlyMap<string, readonly ProjectAct[]>,
  profiles: Iterable<{ id: string; username: string }>,
): UnaccountedAct[] {
  const idByHandle = new Map<string, { id: string; username: string }>();
  for (const profile of profiles) idByHandle.set(profile.username.toLowerCase(), profile);

  const byPerson = new Map<string, RecordedAct[]>();
  for (const record of records) {
    byPerson.set(record.entity_name, [...(byPerson.get(record.entity_name) ?? []), record]);
  }

  const found: UnaccountedAct[] = [];
  for (const [entityName, personRecords] of byPerson) {
    const covered = recordedStatusIds(personRecords);
    const targets = new Set(
      personRecords.flatMap((record) => record.related_post_id?.match(/(\d{15,})$/)?.[1] ?? []),
    );
    const handles = new Set(personRecords.flatMap((record) => recordHandle(record) ?? []));
    for (const handle of handles) {
      const profile = idByHandle.get(handle);
      if (!profile) continue;
      for (const act of acts.get(profile.id) ?? []) {
        if (covered.has(act.postId)) continue;
        found.push({
          entityName,
          username: profile.username,
          act,
          samePost: act.targetId !== null && targets.has(act.targetId),
        });
      }
    }
  }
  return found.sort((a, b) => (a.act.date ?? "").localeCompare(b.act.date ?? ""));
}
