import {
  amplificationCategoryEnum,
  type Amplification,
  type AmplificationCategory,
} from "@/schemas/amplification.schema";
import { isVerifiedRecord } from "@/lib/data/eligibility";

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
