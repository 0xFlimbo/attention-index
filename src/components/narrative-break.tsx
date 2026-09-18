/**
 * docs/HOMEPAGE.md §7 — the product thesis, a major visual moment. Cream
 * statement, then a full-bleed red section (`--color-accent` background,
 * `--color-bg` text). The red block is a full-width sibling with no
 * `container-editorial` on its outer element — background spans the whole
 * viewport, an inner container centers the text — so the page never gets a
 * 100vw-vs-scrollbar horizontal overflow bug. The full red device is used
 * once on the whole homepage, as the spec allows at most 1–2 uses.
 *
 * Contrast: --color-accent (#E34B46) on --color-bg (#F2EFE9) measures
 * ~3.42:1 — meets WCAG AA for large text (>=3:1) but not normal text
 * (4.5:1), so every string inside the red block stays at large-text size
 * (24px+ bold or 18.66px+), never a metadata-scale caption. See report.
 */
export function NarrativeBreak() {
  return (
    <section>
      <div className="container-editorial section-padding-lg">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
          VIEWS ARE
          <br />
          ONLY HALF
          <br />
          THE STORY.
        </h2>
      </div>

      <div className="bg-accent text-bg">
        <div className="container-editorial section-padding-lg">
          <p className="text-hero">
            THE ATTENTION
            <br />
            DIDN&apos;T STAY
            <br />
            INSIDE CRYPTO.
          </p>
          <p className="text-lg md:text-xl mt-10 font-bold tracking-wide uppercase md:mt-14">
            POLITICS / MEDIA / JOURNALISM / BUSINESS / CULTURE
          </p>
        </div>
      </div>
    </section>
  );
}
