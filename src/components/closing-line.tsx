import { ExternalArrow } from "./external-arrow";

/**
 * docs/HOMEPAGE.md §13 — the closing line (section 10). One
 * factual statement and one link to the project this site measures, which
 * until now was reachable only from the footer and `/about`.
 *
 * **It is information, not a recommendation** (docs/HOMEPAGE.md §13). No
 * imperative verb, no community recruitment, no token, no purchase path:
 * "join the community" is an implied endorsement, which docs/PRODUCT.md §18
 * rules out, and the site's growth mechanism is being cited by journalists
 * and researchers rather than converting readers. The second sentence says
 * where the destination is; it never suggests going there.
 *
 * Three calls made with the maintainer when this section was planned, so they
 * are not re-derived from the section sketch:
 *
 * 1. **`OFFICIAL LAYOFFHEDGE ↗`, not `OFFICIAL PROJECT ↗`.** The batch title
 *    uses the latter, but the footer and `/about` already ship the former for
 *    this exact URL, and docs/EDITORIAL.md §9 wants link text that survives
 *    out of context — a third wording for one destination is vocabulary for
 *    nothing.
 * 2. **No disclaimer inside the block.** The hero carries
 *    `project.disclaimer` and the footer's long form sits immediately below
 *    this section, so the independence statement already brackets it twice.
 * 3. **No section eyebrow.** This is a coda, not a section with data, and
 *    docs/DESIGN.md §6 closes the eyebrow list at `01`–`06`.
 *
 * Cream and typographic, with no new visual device: docs/DESIGN.md allows the
 * full red block at most 1–2 times on the homepage and `NarrativeBreak` has
 * spent it. The heading sits in the section-headline register
 * (`text-2xl md:text-3xl`), not the hero's, so the hero stays the page's
 * dominant statement and the Primary Attention Metric stays its dominant
 * number. No motion: the homepage budget is exactly three effects and this
 * adds none.
 *
 * Carries `id="project"` like every other homepage section, which earns it
 * `section[id]`'s `scroll-margin-top` (globals.css) and makes it linkable and
 * reviewable on its own. It is deliberately **not** added to the navigation:
 * `docs/HOMEPAGE.md §3` fixes that list at five entries, and a coda is not a
 * destination a reader navigates to.
 */
interface ClosingLineProps {
  officialProjectUrl: string;
}

export function ClosingLine({ officialProjectUrl }: ClosingLineProps) {
  return (
    <section id="project" className="container-editorial section-padding">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
        ATTENTION CAME FIRST.
      </h2>
      <p className="text-body mt-6 max-w-prose text-ink-soft">
        This site documents the public attention around LayoffHedge. The project itself publishes
        at layoffhedge.com.
      </p>
      <a
        href={officialProjectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-metadata mt-10 inline-block font-bold text-ink underline-offset-2 hover:underline md:mt-14"
      >
        OFFICIAL LAYOFFHEDGE <ExternalArrow />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>
  );
}
