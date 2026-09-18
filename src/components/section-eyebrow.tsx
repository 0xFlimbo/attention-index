/**
 * docs/DESIGN.md §6 — the numbered red section label used above a major
 * homepage section headline: `01 / ATTENTION`, `02 / CROSSOVER`, etc.
 * This numbering is thematic (per §6's own list), not the build-order
 * numbering in docs/HOMEPAGE.md §1 — Attention Grid is thematically "01".
 */
interface SectionEyebrowProps {
  index: string;
  label: string;
}

export function SectionEyebrow({ index, label }: SectionEyebrowProps) {
  return (
    <p className="text-[13px] font-bold tracking-[0.14em] text-accent-ink uppercase">
      {index} / {label}
    </p>
  );
}
