/**
 * docs/HOMEPAGE.md §4 — the hero. Approved copy verbatim. `disclaimer` is
 * read from `project.json` (never retyped) so the independence statement
 * can never drift from the canonical value — docs/CLAUDE.md §3.
 *
 * §4 allows the supporting copy either below the headline or offset right.
 * Below it at mobile/tablet; from `lg` up it moves into the right half of
 * the 12-column editorial grid (docs/DESIGN.md §5) — otherwise the widest
 * layouts leave the whole right side of the hero empty and the section
 * reads as a narrow top-left block rather than the broad, spatial
 * composition §5 asks for.
 */
interface HeroStatementProps {
  disclaimer: string;
}

export function HeroStatement({ disclaimer }: HeroStatementProps) {
  return (
    <section className="container-editorial flex min-h-[85vh] flex-col justify-center border-t-4 border-accent py-16 md:min-h-[90vh]">
      <p className="text-metadata text-ink-soft">
        Unofficial / independent community project
      </p>

      <h1 className="hero-lines text-hero mt-6 text-ink">
        <span>ATTENTION</span>
        <span>IS THE</span>
        <span className="text-accent">ASSET.</span>
      </h1>

      <div className="mt-10 grid grid-cols-1 gap-y-10 md:mt-12 lg:grid-cols-12 lg:items-end lg:gap-x-8">
        <div className="hero-supporting max-w-xl lg:col-span-5 lg:col-start-7">
          <p className="text-body text-ink-soft">
            Tracking how LayoffHedge moved beyond crypto and into public attention.
          </p>
          <p className="text-body mt-3 font-semibold text-ink">
            Public data. Public sources. Open source.
          </p>
        </div>
      </div>

      <p className="text-metadata mt-16 text-ink-soft md:mt-20">{disclaimer}</p>
    </section>
  );
}
