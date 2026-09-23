import type { MediaReference } from "@/schemas/media.schema";
import { formatCountry } from "./country";

/**
 * docs/DATA.md §7 — the three record attributes, rendered as words in the
 * record's own metadata line. There is no star, no badge and no icon:
 * `docs/DESIGN.md` carries no decorative iconography anywhere, and a press
 * kit's star is the one grammar an independent index must not borrow. What
 * the reader gets instead is the fact the flag stands for, spelled out.
 *
 * - `country` is the publication's newsroom, never the story's subject.
 * - a syndicated record says which outlet it credits, so a republication is
 *   never read as a second, independent piece of coverage.
 * - `featured` prints its criterion rather than the word "featured": the
 *   flag means the article named the project as a source in its own text,
 *   and saying that is more informative — and less like a ranking — than
 *   labelling the row.
 *
 * Used by both the Public References panel (docs/HOMEPAGE.md §11) and the
 * `/evidence` media rows, so the two can never describe the same record
 * differently. Order is fixed: country, provenance, then the criterion.
 */
export function mediaReferenceDescriptors(reference: MediaReference): string[] {
  const descriptors: string[] = [];

  if (reference.country !== null) descriptors.push(formatCountry(reference.country));
  if (reference.provenance === "syndicated" && reference.syndicated_from !== null) {
    descriptors.push(`Republished from ${reference.syndicated_from}`);
  }
  if (reference.featured) descriptors.push("Names LayoffHedge as a source");

  return descriptors;
}
