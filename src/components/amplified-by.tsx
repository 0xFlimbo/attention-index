import type { Amplification } from "@/schemas/amplification.schema";
import type { Post } from "@/schemas/post.schema";
import { selectAmplifierGroups } from "@/lib/metrics/amplification";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { SectionEyebrow } from "./section-eyebrow";
import { AmplifierCard, toAmplifierCardData } from "./amplifier-card";

/**
 * docs/HOMEPAGE.md §2 — "enough verified amplifications for a real grid."
 * Counted in cards, which is people, not acts: one person with three acts is
 * one card. 3 is the smallest count that fills a full row at the widest (`lg`,
 * 3-column) breakpoint — below that the section would read as a couple of
 * stray cards rather than a grid, so it stays absent (docs/HOMEPAGE.md §9's
 * "no filters" call already applies at any size; this is purely about
 * whether the *grid* reads as one). A named constant, not a bare number, so
 * the threshold's reasoning travels with the code.
 */
export const AMPLIFIER_GRID_MIN_CARDS = 3;

/**
 * Each person's card is its own link target (`/#amplifier-brigitte-gabriel`),
 * the same way a single media reference is — so a card deep in the grid can be
 * linked to, and reached by `check:visual --anchor`.
 */
export function amplifierAnchorId(entityName: string): string {
  const slug = entityName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `amplifier-${slug}`;
}

/**
 * docs/HOMEPAGE.md §9 — Amplified By (section 06). Self-contained Server
 * Component, same shape as `ViralArchive`/`CrossoverMap`: owns its own
 * eyebrow/headline and decides its own visibility by returning `null` below
 * `AMPLIFIER_GRID_MIN_CARDS`. No filters (Crossover directly above already
 * gives the category breakdown) —
 * so no client interaction is needed and this stays a Server Component.
 */
interface AmplifiedByProps {
  amplifications: Amplification[];
  posts: Post[];
  officialXAccount: string;
}

export function AmplifiedBy({ amplifications, posts, officialXAccount }: AmplifiedByProps) {
  const amplifiers = selectAmplifierGroups(amplifications);
  if (amplifiers.length < AMPLIFIER_GRID_MIN_CARDS) return null;

  const verifiedPostsById = new Map(posts.filter(isVerifiedRecord).map((post) => [post.id, post]));

  return (
    <section id="amplified" className="container-editorial section-padding">
      <SectionEyebrow index="03" label="AMPLIFIED" />
      <h2 className="text-2xl md:text-3xl mt-4 font-bold tracking-tight text-ink">
        WHO CARRIED
        <br />
        THE MESSAGE
        <br />
        FURTHER?
      </h2>

      {/*
        A real list, not a div of divs: this is a set of repeated records, so
        assistive technology should announce how many there are and let a user
        move between them. Purely semantic — the grid layout is unchanged.
      */}
      <ul className="mt-10 grid grid-cols-1 gap-x-8 md:mt-14 md:grid-cols-2 lg:grid-cols-3">
        {amplifiers.map((group) => (
          <li
            key={group.identity}
            id={amplifierAnchorId(group.records[0]?.entity_name ?? group.identity)}
            className="amplifier-entry"
          >
            <AmplifierCard data={toAmplifierCardData(group, verifiedPostsById, officialXAccount)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
