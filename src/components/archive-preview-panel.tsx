import type { ArchiveRowData } from "./archive-row";
import { formatCompactNumber, formatCount } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { SourceFooter } from "./source-footer";

interface ArchivePreviewPanelProps {
  row: ArchiveRowData;
}

/**
 * docs/HOMEPAGE.md §10 — the desktop-only sticky panel `/archive`'s client
 * explorer (`archive-explorer.tsx`) updates on row hover/focus. Every field
 * shown here also lives inside that same row's own `<details>` panel
 * (`archive-row.tsx`), so this preview is additive, never the only path to
 * the data (docs/DESIGN.md §10 — desktop hover must always have a mobile /
 * no-JS equivalent).
 */
export function ArchivePreviewPanel({ row }: ArchivePreviewPanelProps) {
  const index = String(row.rank).padStart(2, "0");

  return (
    <div className="border border-line p-6">
      <p className="font-mono text-metadata text-ink-soft">{index}</p>
      <p className="text-stat-cell mt-2 tabular-nums text-ink">{formatCompactNumber(row.views)}</p>
      <h3 className="text-lg mt-3 font-bold text-ink">{row.subject}</h3>
      <p className="text-metadata mt-2 text-ink-soft">{formatDate(row.publishedAt)}</p>

      {row.summary !== null && <p className="text-body mt-4 text-ink-soft">{row.summary}</p>}

      {(row.likes !== null || row.reposts !== null || row.replies !== null) && (
        <dl className="text-metadata mt-4 flex flex-wrap gap-x-6 gap-y-2 text-ink-soft">
          {row.likes !== null && (
            <div>
              <dt className="inline">Likes </dt>
              <dd className="inline tabular-nums text-ink">{formatCount(row.likes)}</dd>
            </div>
          )}
          {row.reposts !== null && (
            <div>
              <dt className="inline">Reposts </dt>
              <dd className="inline tabular-nums text-ink">{formatCount(row.reposts)}</dd>
            </div>
          )}
          {row.replies !== null && (
            <div>
              <dt className="inline">Replies </dt>
              <dd className="inline tabular-nums text-ink">{formatCount(row.replies)}</dd>
            </div>
          )}
        </dl>
      )}

      <a
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-metadata mt-5 inline-block font-bold text-ink underline-offset-2 hover:underline"
      >
        VIEW SOURCE ↗<span className="sr-only"> for {row.subject}</span>
      </a>
      <SourceFooter sources={[row.platformLabel]} observedAt={row.observedAt} className="mt-4" />
    </div>
  );
}
