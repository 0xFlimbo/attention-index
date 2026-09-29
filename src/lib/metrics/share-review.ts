import {
  FALLBACK_HOOKS,
  SHARE_CARD_IDS,
  X_POST_LIMIT,
  curatedReferences,
  selectShareCards,
  sharePostLength,
  sharePostText,
  type ShareCardInput,
} from "@/lib/metrics/share-cards";

/** A post this close to X's limit is flagged: one more digit or name can push it over. */
export const NEAR_LIMIT_MARGIN = 20;

export interface ShareReviewRow {
  id: string;
  text: string;
  length: number;
}

export interface ShareReview {
  rows: ShareReviewRow[];
  /** Things a person should look at, one sentence each; empty when the page is as written. */
  warnings: string[];
}

/**
 * `pnpm share:review` — what /share would publish with today's data, and what
 * has drifted from the copy as written: a card no longer built, a hook fallen
 * back because its record is gone, a hand-chosen id or name no longer found, a
 * post near the 280-character limit. Pure; the script only prints it.
 */
export function reviewShareCards(input: ShareCardInput): ShareReview {
  const cards = selectShareCards(input);
  const rows = cards.map((card) => {
    const text = sharePostText(card, input.officialXAccount);
    return { id: card.id, text, length: sharePostLength(text) };
  });

  const warnings: string[] = [];
  const built = new Set(cards.map((card) => card.id));
  for (const id of SHARE_CARD_IDS) {
    if (!built.has(id)) warnings.push(`${id}: not built — its records are gone or below its floor.`);
  }

  const fallbacks = new Set<string>(Object.values(FALLBACK_HOOKS));
  for (const card of cards) {
    if (fallbacks.has(card.hook)) warnings.push(`${card.id}: hook fell back to "${card.hook}".`);
  }

  for (const reference of curatedReferences(input)) {
    if (!reference.found) warnings.push(`${reference.card}: ${reference.what} not found among verified records.`);
  }

  for (const row of rows) {
    if (row.length > X_POST_LIMIT) warnings.push(`${row.id}: ${row.length} characters, over ${X_POST_LIMIT}.`);
    else if (row.length > X_POST_LIMIT - NEAR_LIMIT_MARGIN) {
      warnings.push(`${row.id}: ${row.length} characters, within ${NEAR_LIMIT_MARGIN} of the limit.`);
    }
  }

  return { rows, warnings };
}
