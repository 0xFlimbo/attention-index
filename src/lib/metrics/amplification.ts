import {
  amplificationCategoryEnum,
  type Amplification,
  type AmplificationAction,
  type AmplificationCategory,
} from "@/schemas/amplification.schema";
import type { MediaReference } from "@/schemas/media.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { selectPublicationReferences } from "@/lib/metrics/media";
import { outletIdentity } from "@/lib/validation/publication-name";

/**
 * docs/EDITORIAL.md §9 — fixed, neutral category labels for the Crossover
 * diagram and any other category display. `Record<AmplificationCategory, string>`
 * (not a partial map) so adding a category to the schema enum without adding
 * it here is a compile error, not a silently-missing label.
 */
export const AMPLIFICATION_CATEGORY_LABELS: Record<AmplificationCategory, string> = {
  government: "GOVERNMENT",
  politics: "POLITICS",
  journalism: "JOURNALISM",
  media: "MEDIA",
  business: "BUSINESS",
  public_figure: "PUBLIC FIGURES",
};

/**
 * docs/EDITORIAL.md §5 — "never upgrade a weak interaction." One label per
 * schema enum member, `Record<AmplificationAction, string>` so a future enum
 * addition fails to compile here instead of rendering a raw key on a card.
 */
export const AMPLIFICATION_ACTION_LABELS: Record<AmplificationAction, string> = {
  repost: "REPOSTED",
  quote_post: "QUOTE-POSTED",
  reply: "REPLIED TO",
  mention: "MENTIONED",
  share: "SHARED",
  citation: "CITED",
  interview: "INTERVIEWED",
  other: "REFERENCED",
};

/** The project itself, as an act's object when the act is not on a post. */
export const PROJECT_NAME = "LayoffHedge";

const ACTS_ON_A_POST: ReadonlySet<AmplificationAction> = new Set(["repost", "quote_post", "reply"]);

/**
 * What an act was performed on, for the line "QUOTE-POSTED @LAYOFFAI".
 *
 * A repost, quote or reply acts on a post, so the account that wrote it is
 * named — even when that post is not tracked (a quoted @LayoffAI reply).
 * A share, citation, interview or mention acts on the project: the site, a
 * tool, a report, the name. Naming the X account there would claim a post
 * nobody touched ("SHARED @LAYOFFAI" for someone who shared layoffhedge.com).
 */
export function amplificationActTarget(
  action: AmplificationAction,
  officialXAccount: string,
): string {
  return ACTS_ON_A_POST.has(action) ? officialXAccount : PROJECT_NAME;
}

export interface AmplificationMetrics {
  verifiedAmplificationCount: number;
  uniqueAmplifierCount: number;
  countsByCategory: Record<AmplificationCategory, number>;
}

function emptyCategoryCounts(): Record<AmplificationCategory, number> {
  return Object.fromEntries(
    amplificationCategoryEnum.options.map((category) => [category, 0]),
  ) as Record<AmplificationCategory, number>;
}

/** Stable identity for "unique amplifiers" — entity type paired with name (docs/DATA.md §10). */
export function amplifierIdentity(amp: Amplification): string {
  return `${amp.entity_type}:${amp.entity_name.toLowerCase()}`;
}

/**
 * docs/DATA.md §10 — Amplification metrics, computed from eligible amplifications only
 * (`status === "verified" && _placeholder !== true`). Each unique entity is counted once,
 * even if it amplified more than one post.
 */
export function getAmplificationMetrics(amplifications: Amplification[]): AmplificationMetrics {
  const eligible = amplifications.filter(isVerifiedRecord);

  const countsByCategory = emptyCategoryCounts();
  const uniqueAmplifiers = new Set<string>();

  for (const amp of eligible) {
    countsByCategory[amp.category] += 1;
    uniqueAmplifiers.add(amplifierIdentity(amp));
  }

  return {
    verifiedAmplificationCount: eligible.length,
    uniqueAmplifierCount: uniqueAmplifiers.size,
    countsByCategory,
  };
}

/**
 * docs/DATA.md §11 — amplification sort order: featured first, then date
 * descending. Ties (same `featured`, same `date`) are broken by smallest `id`
 * (lexicographic) so the render order is deterministic and reproducible
 * between builds, the same reasoning as `compareArchiveOrder`
 * (src/lib/metrics/archive.ts) — nothing here relies on JS's sort stability.
 */
export function compareAmplifierOrder(a: Amplification, b: Amplification): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if (a.date !== b.date) return a.date > b.date ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * docs/HOMEPAGE.md §9 — the verified, sorted amplifier list the Amplified By
 * grid renders directly. No filters, no pagination — the whole eligible set,
 * ordered by `compareAmplifierOrder`.
 */
export function selectAmplifiers(amplifications: Amplification[]): Amplification[] {
  return amplifications.filter(isVerifiedRecord).slice().sort(compareAmplifierOrder);
}

/** One amplifier and every verified act of theirs, newest act first. */
export interface AmplifierGroup {
  identity: string;
  records: Amplification[];
}

/**
 * docs/HOMEPAGE.md §9 — one card per person, not per act. Groups follow the
 * position of each amplifier's first record under `compareAmplifierOrder`, so
 * a featured act lifts the whole card. Acts inside a group are date-descending
 * (tie: smallest id), which makes `records[0]` the most recent act — the one
 * whose role and category describe the person as they are now
 * (docs/DATA.md §6: the category follows the role at the time of the act).
 */
export function selectAmplifierGroups(amplifications: Amplification[]): AmplifierGroup[] {
  const groups = new Map<string, Amplification[]>();
  for (const amp of selectAmplifiers(amplifications)) {
    const identity = amplifierIdentity(amp);
    const records = groups.get(identity);
    if (records) records.push(amp);
    else groups.set(identity, [amp]);
  }

  return [...groups].map(([identity, records]) => ({
    identity,
    records: records.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      if (a.id === b.id) return 0;
      return a.id < b.id ? -1 : 1;
    }),
  }));
}

/** One Crossover category's derived counts and real examples (docs/HOMEPAGE.md §8). */
export interface CrossoverCategoryData {
  category: AmplificationCategory;
  label: string;
  count: number;
  examples: string[];
}

/** docs/HOMEPAGE.md §8 — "selected real examples," capped so a heavy category doesn't dominate the diagram. */
const CROSSOVER_EXAMPLE_LIMIT = 3;

/**
 * docs/HOMEPAGE.md §8 / docs/DESIGN.md §7 — Crossover categories that have at
 * least one verified record, in the schema's fixed enum order (so node
 * position is a pure function of this array's order, never hand-positioned).
 * Categories with a count of `0` are omitted entirely, never rendered with a
 * zero. `count` is the number of distinct amplifiers in the category, not of
 * acts: a person who quoted two posts is one person under one number.
 * Examples are the first `CROSSOVER_EXAMPLE_LIMIT` distinct entity names in
 * `compareAmplifierOrder` (featured first, then most recent) — real names
 * only, never invented, never repeated.
 *
 * `media` is the one node read from both files: it counts distinct outlets
 * that acted on X or published about LayoffHedge, originals and republications
 * alike, each outlet once (`outletIdentity`). An article stays a media record
 * and never becomes an amplification; only the count is shared. Its examples
 * lead with the publications in Public References order, then outlets known
 * only from X in `compareAmplifierOrder`.
 */
export function selectCrossoverCategories(
  amplifications: Amplification[],
  mediaReferences: MediaReference[],
): CrossoverCategoryData[] {
  const eligible = amplifications.filter(isVerifiedRecord).slice().sort(compareAmplifierOrder);

  return amplificationCategoryEnum.options
    .map((category) => {
      const members = new Map<string, string>();
      if (category === "media") {
        for (const group of selectPublicationReferences(mediaReferences)) {
          const identity = outletIdentity(group.publication);
          if (!members.has(identity)) members.set(identity, group.publication);
        }
      }
      for (const amp of eligible) {
        const identity = category === "media" ? outletIdentity(amp.entity_name) : amplifierIdentity(amp);
        if (amp.category === category && !members.has(identity)) members.set(identity, amp.entity_name);
      }
      const names = [...members.values()];
      return {
        category,
        label: AMPLIFICATION_CATEGORY_LABELS[category],
        count: names.length,
        examples: names.slice(0, CROSSOVER_EXAMPLE_LIMIT),
      };
    })
    .filter((entry) => entry.count > 0);
}
