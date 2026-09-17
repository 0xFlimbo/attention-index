import {
  amplificationCategoryEnum,
  type Amplification,
  type AmplificationAction,
  type AmplificationCategory,
} from "@/schemas/amplification.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";

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
  tech: "TECH",
  public_figure: "PUBLIC FIGURES",
  other: "OTHER",
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
function amplifierIdentity(amp: Amplification): string {
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
 * zero. Examples are the first `CROSSOVER_EXAMPLE_LIMIT` entity names in
 * `compareAmplifierOrder` (featured first, then most recent) — real names
 * only, never invented.
 */
export function selectCrossoverCategories(amplifications: Amplification[]): CrossoverCategoryData[] {
  const eligible = amplifications.filter(isVerifiedRecord).slice().sort(compareAmplifierOrder);

  return amplificationCategoryEnum.options
    .map((category) => {
      const records = eligible.filter((amp) => amp.category === category);
      return {
        category,
        label: AMPLIFICATION_CATEGORY_LABELS[category],
        count: records.length,
        examples: records.slice(0, CROSSOVER_EXAMPLE_LIMIT).map((amp) => amp.entity_name),
      };
    })
    .filter((entry) => entry.count > 0);
}
