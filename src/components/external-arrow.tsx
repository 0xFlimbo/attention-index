/**
 * The `↗` that marks a link leaving this site (`docs/DESIGN.md §6`,
 * `docs/EDITORIAL.md §9` — internal routes take `→` instead).
 *
 * `aria-hidden` because the glyph is a visual convention, not content. There
 * are 138 external links across the five routes, and a screen reader
 * announcing "north east arrow" after every one of them is noise that carries
 * nothing the surrounding text does not already say. What the glyph signals
 * visually is carried for assistive technology by each caller's own `sr-only`
 * text: "(opens in a new tab)" on the site chrome and the section CTAs, or the
 * record's own subject on the repeated per-record source links, where the
 * subject does double duty by making a hundred otherwise identical
 * "VIEW SOURCE" links distinguishable out of context.
 *
 * Added at an accessibility pass, which found the glyph exposed on all 138.
 */
export function ExternalArrow() {
  return <span aria-hidden="true">↗</span>;
}
