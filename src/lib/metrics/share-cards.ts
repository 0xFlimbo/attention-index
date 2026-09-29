import type { Amplification, AmplificationAction, AmplificationCategory } from "@/schemas/amplification.schema";
import type { MediaCitedWork, MediaReference } from "@/schemas/media.schema";
import type { Post } from "@/schemas/post.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { amplifierIdentity, getAmplificationMetrics, selectCrossoverCategories } from "@/lib/metrics/amplification";
import { getMediaMetrics } from "@/lib/metrics/media";
import { latestObservation } from "@/lib/metrics/observation";
import { dataLastUpdated, latestObservationDate } from "@/lib/metrics/last-updated";
import { formatCitedWork } from "@/lib/format/cited-work";
import { formatCountry } from "@/lib/format/country";
import { formatCompactNumber, formatCount } from "@/lib/format/number";
import { formatDateLong } from "@/lib/format/date";
import { mediaCitedWorkEnum } from "@/schemas/media.schema";

/**
 * The `/share` cards (docs/DATA.md §10): one aggregate figure each, written to
 * be reposted. Every figure is derived here from the records at build time;
 * nothing below is a typed-in number.
 *
 * The copy around the figure is editorial and lives in this file: the hook
 * line, and the few names a card mentions. Where a card names a person or an
 * outlet it reads the name from a verified record, and a card whose records
 * are gone either drops that sentence or is not built at all (`null`).
 */

/** What the card's date means: the view readings behind it, the dataset as a whole, or one reading. */
export type ShareCardDateKind = "views" | "data" | "observed";

export interface ShareCard {
  /** Stable slug, used as the card's anchor on /share. */
  id: string;
  /** The line that opens the post. */
  hook: string;
  /** The derived figure, already formatted. */
  figure: string;
  /** The phrase that follows the figure: `{figure} {claim}.` reads as one sentence. */
  claim: string;
  /** A supporting line shown on the page only, never in the post. */
  detail: string | null;
  /** ISO date the figure is true as of. */
  asOf: string;
  dateKind: ShareCardDateKind;
  /** Where the evidence for the figure lives on this site. */
  evidenceHref: string;
  evidenceLabel: string;
}

export interface ShareCardInput {
  posts: Post[];
  amplifications: Amplification[];
  mediaReferences: MediaReference[];
  /** `project.json.official_x_account`, e.g. `@LayoffAI`. */
  officialXAccount: string;
}

/**
 * The token's cashtag, appended to the post text only — never rendered on the
 * page (maintainer decision, 2026-09-29: the page supplies material that
 * other people choose to post; a reader of the site does not see it).
 */
export const SHARE_CASHTAG = "$LAYOFF";

/** X counts every link as 23 characters, whatever its length. */
export const X_LINK_LENGTH = 23;
export const X_POST_LIMIT = 280;

/**
 * The act as a verb phrase, naming what it was performed on — the same split
 * as `amplificationActTarget`: an act on a post names the account, an act on
 * the project names the project.
 */
function actPhrase(action: AmplificationAction, account: string): string {
  const phrases: Record<AmplificationAction, string> = {
    repost: `reposted ${account}`,
    quote_post: `quote-posted ${account}`,
    reply: `replied to ${account}`,
    mention: "mentioned LayoffHedge",
    share: "shared LayoffHedge's work",
    citation: "cited LayoffHedge",
    interview: "interviewed LayoffHedge",
    other: "referenced LayoffHedge",
  };
  return phrases[action];
}

/** `["a"]` → `a`; `["a", "b"]` → `a or b`; `["a", "b", "c"]` → `a, b or c`. */
function joinWords(words: string[], conjunction: "and" | "or"): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${conjunction} ${words[words.length - 1]}`;
}

/** Distinct act phrases over records, in the order the actions first appear. */
function actPhrases(records: Amplification[], account: string): string {
  const actions = [...new Set(records.map((record) => record.action))];
  return joinWords(
    actions.map((action) => actPhrase(action, account)),
    "or",
  );
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Median of the latest observation of each eligible post (docs/DATA.md §10):
 * the middle reading, or the mean of the two middle readings for an even
 * count. `null` for no posts.
 */
export function medianObservedViews(posts: Post[]): number | null {
  const views = posts
    .filter(isVerifiedRecord)
    .map((post) => latestObservation(post).views)
    .sort((a, b) => a - b);
  if (views.length === 0) return null;
  const middle = Math.floor(views.length / 2);
  if (views.length % 2 === 1) return views[middle]!;
  return (views[middle - 1]! + views[middle]!) / 2;
}

const FIVE_HUNDRED_THOUSAND = 500_000;

/** Eligible posts whose latest reading is at or above 500,000 (inclusive, like every threshold). */
export function postsOver500K(posts: Post[]): number {
  return posts
    .filter(isVerifiedRecord)
    .filter((post) => latestObservation(post).views >= FIVE_HUNDRED_THOUSAND).length;
}

/*
 * Offices read from the stored `role`. The role is written at the time of the
 * act (docs/DATA.md §6), so "U.S. Representative, Ohio's 8th District" is a
 * sitting member and "Former U.S. Representative, …" or "…; former U.S.
 * Representative" is a former one. Candidates and state legislators match
 * none of these and are left out on purpose: the card counts officeholders.
 */
const SITTING_REPRESENTATIVE = /^U\.S\. Representative\b/;
const FORMER_REPRESENTATIVE = /\bformer U\.S\. Representative\b/i;
const GOVERNOR = /^Governor of /;

/** A record whose stored role matches `pattern`; a record with no role matches nothing. */
function holdsRole(record: Amplification, pattern: RegExp): boolean {
  return record.role !== null && pattern.test(record.role);
}

/** Card 1 — current and former U.S. officeholders in `politics`. */
export function selectOfficeholdersCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const politics = input.amplifications.filter(
    (record) => isVerifiedRecord(record) && record.category === "politics",
  );
  const sitting = politics.filter((record) => holdsRole(record, SITTING_REPRESENTATIVE));
  const former = politics.filter((record) => holdsRole(record, FORMER_REPRESENTATIVE));
  const governors = politics.filter((record) => holdsRole(record, GOVERNOR));
  const officeholders = [...sitting, ...former, ...governors];
  const count = new Set(officeholders.map(amplifierIdentity)).size;
  if (count === 0) return null;

  const named: string[] = [];
  const governor = governors[0];
  if (governor?.role) named.push(`${governor.entity_name}, ${governor.role},`);
  if (sitting.length > 0) {
    named.push(`${sitting.length} sitting ${plural(sitting.length, "member", "members")} of Congress`);
  }
  const among = named.length > 0 ? ` — among them ${named.join(" and ").replace(/,$/, "")}` : "";

  const detail = [
    sitting.length > 0 && `${sitting.length} sitting U.S. ${plural(sitting.length, "Representative", "Representatives")}`,
    former.length > 0 && `${former.length} former U.S. ${plural(former.length, "Representative", "Representatives")}`,
    ...governors.map((record) => record.role),
  ].filter((part): part is string => typeof part === "string");

  return {
    id: "officeholders",
    hook: "Not just crypto Twitter.",
    figure: formatCount(count),
    claim: `current and former U.S. ${plural(count, "officeholder", "officeholders")} ${actPhrases(officeholders, input.officialXAccount)}${among}`,
    detail: detail.join(" · "),
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#amplifications",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/**
 * The reply named in card 2's hook. Curation, declared: the one act the hook
 * opens with, by record id. If the record stops being verified, the hook
 * loses that sentence; the figure does not depend on it.
 */
const HOOK_AMPLIFICATION_ID = "amp-elon-musk-2034731489318048232";

/** Card 2 — every identified public account that amplified LayoffHedge on X. */
export function selectAmplifiersCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const eligible = input.amplifications.filter(isVerifiedRecord);
  const { uniqueAmplifierCount } = getAmplificationMetrics(input.amplifications);
  if (uniqueAmplifierCount === 0) return null;

  const hook: string[] = [];
  const lead = eligible.find((record) => record.id === HOOK_AMPLIFICATION_ID);
  if (lead !== undefined) hook.push(`${lead.entity_name} ${actPhrase(lead.action, input.officialXAccount)}.`);
  const congress = eligible.filter(
    (record) => holdsRole(record, SITTING_REPRESENTATIVE) && record.action === "quote_post",
  );
  if (congress.length > 1) hook.push("Members of Congress quote-posted it.");

  return {
    id: "amplifiers",
    hook: hook.length > 0 ? hook.join(" ") : "Every act on the record.",
    figure: formatCount(uniqueAmplifierCount),
    claim: `identified public ${plural(uniqueAmplifierCount, "account has", "accounts have")} amplified LayoffHedge on X, every act linked to its source`,
    detail: null,
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#amplifications",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/** Card 3 — observed views across tracked posts. */
export function selectObservedViewsCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const { trackedPostCount, totalObservedViews } = getAttentionMetrics(input.posts);
  if (trackedPostCount === 0) return null;
  return {
    id: "observed-views",
    hook: "One account. Every number sourced.",
    figure: formatCompactNumber(totalObservedViews),
    claim: `observed views across ${formatCount(trackedPostCount)} tracked ${input.officialXAccount} ${plural(trackedPostCount, "post", "posts")}`,
    detail: "Observed views are readings of each post's public counter, not unique people.",
    asOf,
    dateKind: "views",
    evidenceHref: "/archive",
    evidenceLabel: "OPEN ARCHIVE",
  };
}

/** Card 4 — original press pieces that cite one of LayoffHedge's works. */
export function selectCitedWorkCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const citing = input.mediaReferences.filter(
    (reference) =>
      isVerifiedRecord(reference) &&
      reference.provenance === "original" &&
      reference.cited_work !== null &&
      reference.cited_work !== "none",
  );
  if (citing.length === 0) return null;
  const publications = new Set(citing.map((reference) => reference.publication)).size;
  const works = mediaCitedWorkEnum.options
    .filter((work) => citing.some((reference) => reference.cited_work === work))
    .map(formatCitedWork)
    .filter((label): label is string => label !== null);
  const { originalReferenceCount } = getMediaMetrics(input.mediaReferences);

  return {
    id: "cited-work",
    hook: "Newsrooms don't just mention it. They cite its work.",
    figure: formatCount(citing.length),
    claim: `original press ${plural(citing.length, "piece", "pieces")} in ${formatCount(publications)} ${plural(publications, "publication", "publications")} ${plural(citing.length, "cites", "cite")} LayoffHedge's work: ${joinWords(works, "or")}`,
    detail: `Of ${formatCount(originalReferenceCount)} original press references. Republications are not counted.`,
    asOf,
    dateKind: "data",
    evidenceHref: "/methodology#cited-work",
    evidenceLabel: "METHODOLOGY",
  };
}

/**
 * The broadcast card 5's hook describes, and the publication its claim names.
 * Curation, declared, by record id and publication name; each sentence is
 * dropped when its record is no longer verified.
 */
const HOOK_MEDIA_ID = "media-fox-news-2026-06-05";
const NAMED_PUBLICATION = "Newsweek";

/** Card 5 — every press reference, across every publication. */
export function selectPressCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const eligible = input.mediaReferences.filter(isVerifiedRecord);
  const { verifiedMediaReferenceCount, uniquePublicationCount } = getMediaMetrics(input.mediaReferences);
  if (verifiedMediaReferenceCount === 0) return null;

  const broadcast = eligible.find((reference) => reference.id === HOOK_MEDIA_ID);
  const named = eligible.some((reference) => reference.publication === NAMED_PUBLICATION);

  return {
    id: "press",
    hook:
      broadcast !== undefined
        ? `${broadcast.publication} put the H-1B chart on air, crediting LayoffHedge.`
        : "Not only crypto media.",
    figure: formatCount(verifiedMediaReferenceCount),
    claim: `press ${plural(verifiedMediaReferenceCount, "reference", "references")} across ${formatCount(uniquePublicationCount)} ${plural(uniquePublicationCount, "publication", "publications")}${named ? `, ${NAMED_PUBLICATION} among them` : ""}`,
    detail: null,
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#media",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/** Card 6 — posts above 1M, and above 500K. Needs two or more: one post is a one-off. */
export function selectPostsAbove1MCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const { postsOver1M } = getAttentionMetrics(input.posts);
  if (postsOver1M < 2) return null;
  return {
    id: "posts-above-1m",
    hook: "Not a one-off.",
    figure: formatCount(postsOver1M),
    claim: `tracked ${input.officialXAccount} posts above 1M observed views, ${formatCount(postsOver500K(input.posts))} above 500K`,
    detail: null,
    asOf,
    dateKind: "views",
    evidenceHref: "/archive",
    evidenceLabel: "OPEN ARCHIVE",
  };
}

/** Card 7 — the median tracked post. */
export function selectMedianPostCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const median = medianObservedViews(input.posts);
  if (median === null) return null;
  const { trackedPostCount } = getAttentionMetrics(input.posts);
  return {
    id: "median-post",
    hook: "Forget the best post. Look at the typical one.",
    figure: formatCompactNumber(median),
    claim: `observed views on the median tracked ${input.officialXAccount} post, across ${formatCount(trackedPostCount)} tracked ${plural(trackedPostCount, "post", "posts")}`,
    detail: "The middle reading when the tracked posts are ranked by observed views.",
    asOf,
    dateKind: "views",
    evidenceHref: "/archive",
    evidenceLabel: "OPEN ARCHIVE",
  };
}

/** Card 8 — government accounts, named by the department they sit in, not by person. */
export function selectGovernmentCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const government = input.amplifications.filter(
    (record) => isVerifiedRecord(record) && record.category === "government",
  );
  const count = new Set(government.map(amplifierIdentity)).size;
  if (count === 0) return null;

  const departments = [
    ...new Set(
      government
        .map((record) => record.organization)
        .filter((organization): organization is string => organization !== null)
        .map((organization) => organization.replace(/^U\.S\. /, "")),
    ),
  ];
  const allUS = government.every((record) => record.country === "US");
  const at = departments.length > 0 ? `, at the ${departments.join(" and the ")}` : "";

  return {
    id: "government",
    hook: allUS ? "Inside the U.S. government, too." : "Inside government, too.",
    figure: formatCount(count),
    claim: `government ${plural(count, "account", "accounts")} ${actPhrases(government, input.officialXAccount)}${at}`,
    detail: null,
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#amplifications",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/** Card 9 — newsroom countries, originals only (`countryCount`). Needs two or more. */
export function selectNewsroomCountriesCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const { countryCount, referencesByCountry } = getMediaMetrics(input.mediaReferences);
  if (countryCount < 2) return null;
  const countries = Object.entries(referencesByCountry)
    .sort(([codeA, countA], [codeB, countB]) => countB - countA || (codeA < codeB ? -1 : 1))
    .map(([code]) => formatCountry(code));

  return {
    id: "newsroom-countries",
    hook: "Not only an American story.",
    figure: formatCount(countryCount),
    claim: "countries have newsrooms that published original reporting referencing LayoffHedge",
    detail: countries.join(" · "),
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#media",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/** Card 10's plural noun for each non-media Crossover node. */
const CROSSOVER_NOUNS: Record<Exclude<AmplificationCategory, "media">, string> = {
  politics: "politicians",
  government: "officials",
  journalism: "journalists",
  business: "business leaders",
  public_figure: "public figures",
};
const CROSSOVER_NOUN_ORDER: Exclude<AmplificationCategory, "media">[] = [
  "politics",
  "government",
  "journalism",
  "business",
  "public_figure",
];

/**
 * Card 10 — the Crossover map in one sentence. The figure is the non-media
 * nodes only: the media node counts outlets from X and the press
 * (docs/DATA.md §10), a different unit, so it follows as its own number
 * rather than being added in.
 */
export function selectCrossoverCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const categories = selectCrossoverCategories(input.amplifications, input.mediaReferences);
  const counts = new Map(categories.map((entry) => [entry.category, entry.count]));
  const present = CROSSOVER_NOUN_ORDER.filter((category) => (counts.get(category) ?? 0) > 0);
  const figure = present.reduce((sum, category) => sum + (counts.get(category) ?? 0), 0);
  if (figure === 0) return null;
  const outlets = counts.get("media") ?? 0;

  return {
    id: "crossover",
    hook: "The attention didn't stay inside crypto.",
    figure: formatCount(figure),
    claim: `${joinWords(
      present.map((category) => CROSSOVER_NOUNS[category]),
      "and",
    )} amplified LayoffHedge on X${outlets > 0 ? `, plus ${formatCount(outlets)} media ${plural(outlets, "outlet", "outlets")}` : ""}`,
    detail:
      outlets > 0
        ? "A media outlet counts once, whether it posted on X or published about LayoffHedge."
        : null,
    asOf,
    dateKind: "data",
    evidenceHref: "/#crossover",
    evidenceLabel: "EXPLORE THE DATA",
  };
}

/*
 * Cards on LayoffHedge's own work, read through what others did with it: the
 * press citing a dataset, newsrooms reporting an investigation, accounts
 * sharing the site and tools. The work is named only as `docs/EDITORIAL.md`
 * names it — a description, never a rating.
 */

function numberWord(count: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  return words[count] ?? formatCount(count);
}

/** Original references citing one work, and the publications among them. */
function originalsCiting(input: ShareCardInput, work: MediaCitedWork): MediaReference[] {
  return input.mediaReferences.filter(
    (reference) =>
      isVerifiedRecord(reference) && reference.provenance === "original" && reference.cited_work === work,
  );
}

/** Publications a work card may name, in this order, each only if it cites that work. */
const WORK_CARD_NAMES: Partial<Record<MediaCitedWork, readonly string[]>> = {
  h1b_data: ["Newsweek", "Fox News"],
  layoff_data: ["IBTimes UK"],
};

function selectWorkCard(
  input: ShareCardInput,
  asOf: string,
  work: MediaCitedWork,
  id: string,
  hook: string,
): ShareCard | null {
  const citing = originalsCiting(input, work);
  const label = formatCitedWork(work);
  if (citing.length === 0 || label === null) return null;
  const publications = new Set(citing.map((reference) => reference.publication));
  const named = (WORK_CARD_NAMES[work] ?? []).filter((name) => publications.has(name));

  return {
    id,
    hook,
    figure: formatCount(citing.length),
    claim: `original press ${plural(citing.length, "piece", "pieces")} in ${formatCount(publications.size)} ${plural(publications.size, "publication", "publications")} ${plural(citing.length, "cites", "cite")} LayoffHedge's ${label.replace(/^the /, "")}${named.length > 0 ? `, ${joinWords(named, "and")} among them` : ""}`,
    detail: "Republications are not counted.",
    asOf,
    dateKind: "data",
    evidenceHref: "/methodology#cited-work",
    evidenceLabel: "METHODOLOGY",
  };
}

/** Card — original press pieces citing the H-1B filings data. */
export function selectH1BDataCard(input: ShareCardInput, asOf: string): ShareCard | null {
  return selectWorkCard(input, asOf, "h1b_data", "h1b-data", "The H-1B data made the news.");
}

/** Card — original press pieces citing the layoff data. */
export function selectLayoffDataCard(input: ShareCardInput, asOf: string): ShareCard | null {
  return selectWorkCard(input, asOf, "layoff_data", "layoff-data", "Its layoff numbers get quoted.");
}

/**
 * The @LayoffAI post that carried an investigation, chosen by id (declared
 * curation). No media record is tied to a post (`related_post_id` is null on
 * all of them), so the newsroom count covers every investigation and the post
 * is named as one of them — true however many investigations there are.
 */
const INVESTIGATION_POST_ID = "post-layoffai-2098762091423203710";
const INVESTIGATION_DESCRIPTION = "Trine University's international enrollment";

/**
 * `["Department of Justice", "Department of Labor"]` → `the Justice and Labor
 * Departments`; any other name is kept whole (`the X and the Y`).
 */
function shortDepartments(departments: string[]): string {
  const prefix = /^Department of /;
  if (!departments.every((name) => prefix.test(name))) return `the ${departments.join(" and the ")}`;
  const names = departments.map((name) => name.replace(prefix, ""));
  return `the ${joinWords(names, "and")} ${plural(names.length, "Department", "Departments")}`;
}

/** An act as a past-tense verb taking the post as its object: "accounts … quote-posted the one on …". */
const PAST_TENSE_ACTS: Record<AmplificationAction, string> = {
  repost: "reposted",
  quote_post: "quote-posted",
  reply: "replied to",
  mention: "mentioned",
  share: "shared",
  citation: "cited",
  interview: "discussed",
  other: "referenced",
};

/** Card — newsrooms reporting LayoffHedge's investigations, and the federal accounts that quoted one. */
export function selectInvestigationCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const reporting = originalsCiting(input, "investigation");
  const newsrooms = new Set(reporting.map((reference) => reference.publication)).size;
  if (newsrooms === 0) return null;

  const post = input.posts.find((entry) => entry.id === INVESTIGATION_POST_ID && isVerifiedRecord(entry));
  const government = input.amplifications.filter(
    (record) =>
      isVerifiedRecord(record) && record.category === "government" && record.related_post_id === INVESTIGATION_POST_ID,
  );
  const offices = new Set(government.map(amplifierIdentity)).size;
  const departments = [
    ...new Set(
      government
        .map((record) => record.organization)
        .filter((organization): organization is string => organization !== null)
        .map((organization) => organization.replace(/^U\.S\. /, "")),
    ),
  ];
  const verbs = joinWords([...new Set(government.map((record) => PAST_TENSE_ACTS[record.action]))], "or");
  const quoted =
    post !== undefined && offices > 0 && departments.length > 0
      ? `. Accounts at ${shortDepartments(departments)} ${verbs} the one on ${INVESTIGATION_DESCRIPTION}`
      : "";

  return {
    id: "investigation",
    hook:
      quoted !== ""
        ? `One investigation, ${numberWord(offices)} federal ${plural(offices, "office", "offices")}.`
        : "Newsrooms report its investigations.",
    figure: formatCount(newsrooms),
    claim: `${plural(newsrooms, "newsroom", "newsrooms")} reported LayoffHedge's investigations${quoted}`,
    detail: null,
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#media",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/**
 * The post with the most recorded acts, chosen by id (declared curation) so
 * the neutral description beside it stays true: it describes this post, not
 * whichever post leads next month.
 */
const DISTRICTS_POST_ID = "post-layoffai-2087170419027526094";
const DISTRICTS_POST_DESCRIPTION = "H-1B growth by congressional district";

/** Card — how many identified accounts amplified the one H-1B districts post. */
export function selectDistrictsPostCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const post = input.posts.find((entry) => entry.id === DISTRICTS_POST_ID && isVerifiedRecord(entry));
  if (post === undefined) return null;
  const acts = input.amplifications.filter(
    (record) => isVerifiedRecord(record) && record.related_post_id === DISTRICTS_POST_ID,
  );
  const accounts = new Set(acts.map(amplifierIdentity)).size;
  if (accounts < 2) return null;
  const politicians = new Set(acts.filter((record) => record.category === "politics").map(amplifierIdentity)).size;
  const congress = acts.some((record) => holdsRole(record, SITTING_REPRESENTATIVE));

  return {
    id: "districts-post",
    hook: congress ? "Members of Congress quote-posted this one." : "One post, many accounts.",
    figure: formatCount(accounts),
    claim: `identified accounts amplified a single ${input.officialXAccount} post on ${DISTRICTS_POST_DESCRIPTION}${politicians > 0 ? `, ${formatCount(politicians)} ${plural(politicians, "politician", "politicians")} among them` : ""}`,
    detail: null,
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#amplifications",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/** Acts on the project rather than on a post, as past-tense verbs in a fixed order. */
const ACTS_ON_THE_PROJECT: [AmplificationAction, string][] = [
  ["share", "shared"],
  ["citation", "cited"],
  ["mention", "mentioned"],
];

/** Card — identified accounts that shared, cited or mentioned the site, data and tools on X. */
export function selectSiteAndToolsCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const actions = new Set(ACTS_ON_THE_PROJECT.map(([action]) => action));
  const acts = input.amplifications.filter((record) => isVerifiedRecord(record) && actions.has(record.action));
  const accounts = new Set(acts.map(amplifierIdentity)).size;
  if (accounts === 0) return null;
  const verbs = ACTS_ON_THE_PROJECT.filter(([action]) => acts.some((record) => record.action === action)).map(
    ([, verb]) => verb,
  );
  const formerMembers = new Set(
    acts.filter((record) => holdsRole(record, FORMER_REPRESENTATIVE)).map(amplifierIdentity),
  ).size;

  return {
    id: "site-and-tools",
    hook: "Not just the posts. The site itself.",
    figure: formatCount(accounts),
    claim: `identified ${plural(accounts, "account", "accounts")} ${joinWords(verbs, "or")} LayoffHedge's site, data and tools on X${formerMembers > 0 ? `, ${numberWord(formerMembers)} former ${plural(formerMembers, "member", "members")} of Congress among them` : ""}`,
    detail: null,
    asOf,
    dateKind: "data",
    evidenceHref: "/evidence#amplifications",
    evidenceLabel: "VIEW EVIDENCE",
  };
}

/** Card 11 — references that meet the featured criterion ("Names LayoffHedge as a source"). */
export function selectNamedAsSourceCard(input: ShareCardInput, asOf: string): ShareCard | null {
  const { featuredReferenceCount } = getMediaMetrics(input.mediaReferences);
  if (featuredReferenceCount === 0) return null;
  return {
    id: "named-as-source",
    hook: "Credited, not just mentioned.",
    figure: formatCount(featuredReferenceCount),
    claim: `press ${plural(featuredReferenceCount, "reference names", "references name")} LayoffHedge as a source`,
    detail: null,
    asOf,
    dateKind: "data",
    evidenceHref: "/methodology#media-contract",
    evidenceLabel: "METHODOLOGY",
  };
}

/** Card 12 — the most viewed tracked post, dated by its own reading. */
export function selectTopPostCard(input: ShareCardInput): ShareCard | null {
  const { topPost } = getAttentionMetrics(input.posts);
  if (topPost === null) return null;
  return {
    id: "top-post",
    hook: "One post.",
    figure: formatCompactNumber(topPost.views),
    claim: `observed views on the most viewed tracked ${input.officialXAccount} post`,
    detail: topPost.post.title,
    asOf: topPost.observedAt.slice(0, 10),
    dateKind: "observed",
    evidenceHref: "/archive",
    evidenceLabel: "OPEN ARCHIVE",
  };
}

/** Every card in page order, `null` cards dropped. */
export function selectShareCards(input: ShareCardInput): ShareCard[] {
  const viewsAsOf = latestObservationDate(input.posts);
  const dataAsOf = dataLastUpdated(input.posts, input.amplifications, input.mediaReferences);
  type DatedSelector = (input: ShareCardInput, asOf: string) => ShareCard | null;
  // A card with nothing to date has no records behind it either.
  const views = (select: DatedSelector) => (viewsAsOf === null ? null : select(input, viewsAsOf));
  const data = (select: DatedSelector) => (dataAsOf === null ? null : select(input, dataAsOf));

  const cards: (ShareCard | null)[] = [
    data(selectOfficeholdersCard),
    data(selectAmplifiersCard),
    views(selectObservedViewsCard),
    data(selectCitedWorkCard),
    data(selectH1BDataCard),
    data(selectLayoffDataCard),
    data(selectInvestigationCard),
    data(selectPressCard),
    views(selectPostsAbove1MCard),
    views(selectMedianPostCard),
    data(selectGovernmentCard),
    data(selectDistrictsPostCard),
    data(selectSiteAndToolsCard),
    data(selectNewsroomCountriesCard),
    data(selectCrossoverCard),
    data(selectNamedAsSourceCard),
    selectTopPostCard(input),
  ];
  return cards.filter((card): card is ShareCard => card !== null);
}

const DATE_SENTENCE: Record<ShareCardDateKind, string> = {
  views: "Views as of",
  data: "As of",
  observed: "Observed",
};

/**
 * The text a "Post on X" link pre-fills: hook, figure and claim as one
 * sentence, the date, the account and the cashtag. The link to this site is
 * passed separately (`url=`), and X adds it after the text.
 */
export function sharePostText(card: ShareCard, officialXAccount: string): string {
  const parts = [
    card.hook,
    `${card.figure} ${card.claim}.`,
    `${DATE_SENTENCE[card.dateKind]} ${formatDateLong(card.asOf)}.`,
  ];
  if (!parts.join(" ").includes(officialXAccount)) parts.push(officialXAccount);
  parts.push(SHARE_CASHTAG);
  return parts.join(" ");
}

/** The length X will count for the post: the text, a space, and the link at its fixed weight. */
export function sharePostLength(text: string): number {
  return text.length + 1 + X_LINK_LENGTH;
}

/** `https://x.com/intent/post?text=…&url=…` — a plain link, no client script. */
export function shareIntentUrl(card: ShareCard, officialXAccount: string, siteUrl: string): string {
  const params = new URLSearchParams({
    text: sharePostText(card, officialXAccount),
    url: `${siteUrl}${card.evidenceHref}`,
  });
  return `https://x.com/intent/post?${params.toString()}`;
}
