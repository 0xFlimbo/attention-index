import type { AttentionGridCell } from "@/lib/metrics/attention-grid";
import { SectionEyebrow } from "./section-eyebrow";
import { StatCell } from "./stat-cell";

/**
 * docs/HOMEPAGE.md §6 — Attention Grid. `cells` is already resolved by
 * `selectAttentionGridCells` (docs/DATA.md §10) — this component only lays
 * them out. Desktop 2×2; mobile 1 column — the labels here run up to
 * "OBSERVED VIEWS ACROSS TRACKED POSTS", too long to stay comfortably
 * readable two-across at 390px, so mobile stays single column (see report).
 */
interface StatGridProps {
  cells: AttentionGridCell[];
}

export function StatGrid({ cells }: StatGridProps) {
  return (
    <section id="attention" className="container-editorial section-padding">
      <SectionEyebrow index="01" label="ATTENTION" />
      <h2 className="text-2xl md:text-3xl mt-4 font-bold tracking-tight text-ink">
        HOW MUCH
        <br />
        ATTENTION?
      </h2>

      <div className="mt-10 grid grid-cols-1 items-stretch gap-px bg-line md:mt-14 md:grid-cols-2">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-bg">
            <StatCell cell={cell} />
          </div>
        ))}
      </div>
    </section>
  );
}
