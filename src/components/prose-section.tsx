import type { ReactNode } from "react";

/**
 * A titled section of a long-form prose page (`/methodology`, `/about`).
 *
 * docs/DESIGN.md §5 sets a "12-column editorial grid on desktop" and rules out
 * narrow content columns standing beside empty space — the same defect already
 * corrected at the B2 hero, the B4 Crossover diagram and the B5 Evidence panel
 * and footer. Stacked prose keeps a readable measure (`max-w-prose` on the
 * children), but at 1440 that left the right half of both new pages empty.
 *
 * From `lg` up the heading becomes a side-head in columns 1–4 and the body
 * runs in 5–12, so the whitespace is structural rather than leftover and the
 * reading measure is unchanged. Below `lg` this is exactly the previous
 * markup: a heading stacked above its body, which is the right shape on a
 * phone and what the 390 review already approved.
 *
 * The first child's own top margin is zeroed at `lg` only, so the side-head
 * and the first paragraph share a baseline there while the stacked layout
 * keeps its heading-to-body gap.
 */
interface ProseSectionProps {
  /** Anchor target — `pnpm check:visual --anchor <id>` and native in-page links (docs/ENGINEERING.md §6). */
  id?: string;
  heading: string;
  children: ReactNode;
}

export function ProseSection({ id, heading, children }: ProseSectionProps) {
  return (
    <section id={id} className="mt-16 md:mt-20 lg:grid lg:grid-cols-12 lg:gap-x-10">
      <h2 className="text-lg font-bold tracking-tight text-ink lg:col-span-4">{heading}</h2>
      {/*
        Seven columns, not eight. At eight the body column is ~904px and the
        children's `max-w-prose` (65 `ch`, and `ch` measures the wide `0`)
        stops capping anything — lines ran ~85 characters, long for a page
        whose whole job is being read. Seven brings the measure back to the
        mid-70s and leaves the twelfth column as a trailing margin, which is
        not the "narrow column beside a void" §5 rules out: the text block is
        the dominant mass here, and the heading column carries the left.
      */}
      <div className="lg:col-span-7 lg:[&>*:first-child]:mt-0">{children}</div>
    </section>
  );
}
