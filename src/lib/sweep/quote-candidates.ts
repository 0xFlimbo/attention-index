/**
 * The decisions `scripts/sweep-quote-tweets.ts` makes about a quote post
 * (docs/WORKPLAN.md B10), kept here as pure functions so they can be tested
 * without an API call. Nothing on the site imports this — it is maintenance-tool
 * logic, in `src/lib` for the same reason `src/lib/validation/placeholder.ts` is.
 *
 * These three functions decide what a human is asked to read. A silent bug in
 * any of them would either bury a real amplifier in noise or hand the maintainer
 * a record that was never the account's own act, which is the one failure this
 * project treats as worse than finding nothing (`CLAUDE.md §3`).
 */

/** Only the fields the sweep reads, so the tool's API types stay in the script. */
export interface QuotingAccount {
  username: string;
  name: string;
  description?: string;
  verified_type?: string;
  public_metrics?: { followers_count?: number };
}

export interface ReferencedTweetLike {
  type: string;
  id: string;
}

export interface AmplificationLike {
  account: string | null;
  evidence_url: string;
}

/** The project's own account never amplifies its own post. */
export const SELF_ACCOUNT = "@layoffai";

/**
 * A following large enough to be worth a look. Not evidence of anything on its
 * own — it is one of three flags, and the tool prints all three rather than
 * combining them into a number.
 */
export const LARGE_FOLLOWING = 50_000;

/**
 * Phrases that name a public role in an account's own words. Deliberately
 * literal and conservative: the sweep is looking for a reason to put an account
 * in front of a human, not deciding anything. `docs/EDITORIAL.md §5` governs how
 * a role is finally written down, and that is a human's sentence, never this
 * list's.
 */
export const ROLE_PHRASES = [
  "u.s. senator",
  "senator",
  "congressman",
  "congresswoman",
  "representative",
  "rep.",
  "member of congress",
  "governor",
  "attorney general",
  "state senator",
  "assemblyman",
  "mayor",
  "secretary of",
  "commissioner",
  "ambassador",
  "member of parliament",
  "journalist",
  "reporter",
  "correspondent",
  "editor",
  "columnist",
  "anchor",
  "host of",
  "staff writer",
  "contributing writer",
  "news director",
  "bureau chief",
  "ceo",
  "chief executive",
  "founder",
  "co-founder",
  "cto",
  "cfo",
  "coo",
  "president of",
  "chairman",
  "executive director",
  "professor",
  "economist",
] as const;

/**
 * Whether this entry is a quote **of this post**, rather than a reply inside
 * one of its quote threads.
 *
 * Measured 2026-09-20: with `exclude=retweets` already applied, 392 entries
 * returned for the highest-quote post still resolved to 199 quotes and 151
 * replies. Without this check the sweep would offer a human replies to read as
 * if they were amplifications of the tracked post.
 */
export function isQuoteOfPost(
  referencedTweets: ReferencedTweetLike[] | undefined,
  statusId: string,
): boolean {
  return (referencedTweets ?? []).some(
    (reference) => reference.type === "quoted" && reference.id === statusId,
  );
}

/**
 * Every account already in `data/amplifications.json`, at any status, plus the
 * project's own account. An archived or `needs_review` record is still a record
 * the maintainer has seen, and re-reporting it as a discovery would spend the
 * reading twice.
 *
 * Both the stored `account` and the handle inside `evidence_url` are indexed:
 * a record whose `account` is null still names its account in the URL, and the
 * two must not disagree about whether an account is known.
 */
export function knownAccountKeys(amplifications: AmplificationLike[]): Set<string> {
  const known = new Set<string>([SELF_ACCOUNT]);
  for (const record of amplifications) {
    if (record.account) known.add(record.account.toLowerCase());
    const handle = record.evidence_url.match(/(?:x|twitter)\.com\/([^/?#]+)/i)?.[1];
    if (handle) known.add(`@${handle.toLowerCase()}`);
  }
  return known;
}

/**
 * Plain signals to read, never a ranking. There is deliberately no score and no
 * order of merit: this project does not invent Influence or Attention numbers
 * (`CLAUDE.md §3`), and a maintenance tool is not a licence to start.
 *
 * `verified_type` is checked only for `government`, the one value that names an
 * office. Measured 2026-09-20 across 105 quoting accounts, the field returned
 * only `blue` (48) and `none` (57) — a paid subscription, which stands for
 * nothing here and is never flagged.
 */
export function signalFlags(user: QuotingAccount): string[] {
  const flags: string[] = [];
  if (user.verified_type === "government") flags.push("government-verified");

  const haystack = `${user.description ?? ""} ${user.name}`.toLowerCase();
  const matched = ROLE_PHRASES.filter((phrase) => haystack.includes(phrase));
  if (matched.length > 0) flags.push(`role-phrase: ${matched.slice(0, 3).join(", ")}`);

  if ((user.public_metrics?.followers_count ?? 0) >= LARGE_FOLLOWING) flags.push("large-following");
  return flags;
}
