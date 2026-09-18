import type { AttentionGridCell } from "@/lib/metrics/attention-grid";
import { SourceFooter } from "./source-footer";
import { ExternalArrow } from "./external-arrow";

/**
 * docs/DESIGN.md §6 — one Attention Grid cell. Flat, border-led, no shadow,
 * no lift on hover; hover only shifts the surface color.
 *
 * docs/HOMEPAGE.md §6 allows hover to *reveal* the source link and
 * observation date. It deliberately does not here: the spec says "may", the
 * same section forbids hiding the observation date on mobile, and a
 * hover-only reveal would be a fourth motion effect on top of the homepage's
 * three-effect budget (docs/DESIGN.md §8). The block is simply always
 * visible, at every width.
 */
interface StatCellProps {
  cell: AttentionGridCell;
}

export function StatCell({ cell }: StatCellProps) {
  const { sourceUrl, observedAt } = cell;

  return (
    <div className="stat-cell h-full border border-line p-6 transition-colors duration-300 hover:bg-bg-soft md:p-8">
      <p className="text-stat-cell tabular-nums text-ink">{cell.value}</p>
      <p className="text-metadata mt-3 text-ink-soft">{cell.label}</p>

      {sourceUrl !== null && observedAt !== null && (
        <div className="stat-cell-source mt-5 border-t border-line pt-4">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-metadata font-bold text-ink underline-offset-2 hover:underline"
          >
            VIEW SOURCE <ExternalArrow /><span className="sr-only"> for {cell.label.toLowerCase()}</span>
          </a>
          <SourceFooter
            sources={[cell.sourcePlatformLabel ?? "Source"]}
            observedAt={observedAt}
            className="mt-3"
          />
        </div>
      )}
    </div>
  );
}
