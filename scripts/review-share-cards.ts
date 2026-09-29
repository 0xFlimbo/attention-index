/**
 * pnpm share:review
 *
 * Prints every post /share would offer with today's data — the exact text a
 * "Post on X" link pre-fills and the length X will count — then what has
 * drifted from the copy as written (src/lib/metrics/share-review.ts). Run it
 * after a data refresh, a sweep or a press import, before a deploy.
 *
 * Reads `data/` only; writes nothing; makes no network request. $0.
 * Exits 1 when a post is over 280 characters, the one state the page must
 * never ship; every other warning is for a person to read.
 */
import { getAmplifications, getMediaReferences, getPosts, getProjectMetadata } from "../src/lib/data";
import { X_POST_LIMIT } from "../src/lib/metrics/share-cards";
import { reviewShareCards } from "../src/lib/metrics/share-review";

const review = reviewShareCards({
  posts: getPosts(),
  amplifications: getAmplifications(),
  mediaReferences: getMediaReferences(),
  officialXAccount: getProjectMetadata().official_x_account,
});

console.log(`share:review — ${review.rows.length} cards\n`);
for (const row of review.rows) {
  console.log(`[${row.id}] ${row.length}/${X_POST_LIMIT}`);
  console.log(`  ${row.text}\n`);
}

if (review.warnings.length === 0) {
  console.log("No warnings: every card is built, every hook and name is as written.");
} else {
  console.log(`${review.warnings.length} warning(s):`);
  for (const warning of review.warnings) console.log(`  - ${warning}`);
}

if (review.rows.some((row) => row.length > X_POST_LIMIT)) process.exit(1);
