"use client";

import { useState } from "react";
import type { ArchiveThresholdId, ArchiveThresholdOption } from "@/lib/metrics/archive";
import { ArchiveRow, type ArchiveRowData } from "./archive-row";
import { ArchivePreviewPanel } from "./archive-preview-panel";

interface ArchiveExplorerProps {
  /** Full sorted archive, stable rank already assigned server-side — never renumbered here. */
  rows: ArchiveRowData[];
  thresholds: ArchiveThresholdOption[];
}

/**
 * docs/ENGINEERING.md §2 — the only interactive piece of `/archive`:
 * threshold filtering and the desktop hover/focus preview. Both are pure
 * enhancement over `ArchiveRow`'s own zero-JS `<details>` panel — filtering
 * only ever hides rows (it never changes `row.rank`, so `01` always means
 * "most viewed tracked post"), and the sticky preview never carries
 * information that isn't already inside the row it mirrors. `rows`/
 * `thresholds` are plain serializable data computed on the server
 * (`src/app/archive/page.tsx`), kept as small as this component's actual job.
 */
export function ArchiveExplorer({ rows, thresholds }: ArchiveExplorerProps) {
  const [activeThresholdId, setActiveThresholdId] = useState<ArchiveThresholdId>("all");
  // Server-rendered with the first row's data so the preview is never empty.
  const [previewRowId, setPreviewRowId] = useState<string | null>(rows[0]?.id ?? null);

  if (rows.length === 0) {
    return <p className="text-body text-ink-soft">No verified records yet.</p>;
  }

  const activeThreshold = thresholds.find((option) => option.id === activeThresholdId);
  const visibleRows = rows.filter((row) => {
    if (activeThreshold === undefined || activeThreshold.minViews === null) return true;
    return row.views >= activeThreshold.minViews;
  });

  const previewRow = rows.find((row) => row.id === previewRowId) ?? rows[0];

  return (
    <div>
      <div role="group" aria-label="Filter by observed views" className="flex flex-wrap gap-3">
        {thresholds.map((option) => {
          const isActive = option.id === activeThresholdId;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveThresholdId(option.id)}
              className={`text-metadata min-h-11 border px-4 font-bold transition-colors duration-300 ${
                isActive ? "border-ink bg-ink text-bg" : "border-line text-ink hover:bg-bg-soft"
              }`}
            >
              {option.label} <span aria-hidden="true" className="tabular-nums opacity-70">{option.count}</span>
              <span className="sr-only"> — {option.count} records</span>
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="text-metadata mt-4 text-ink-soft">
        {visibleRows.length === 0
          ? "No records match this filter."
          : `Showing ${visibleRows.length} of ${rows.length} records.`}
      </p>

      <div className="mt-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-12">
        <div>
          {visibleRows.map((row) => (
            <ArchiveRow key={row.id} row={row} onPreview={() => setPreviewRowId(row.id)} />
          ))}
        </div>

        {previewRow !== undefined && (
          <aside className="sticky top-24 hidden lg:block">
            <ArchivePreviewPanel row={previewRow} />
          </aside>
        )}
      </div>
    </div>
  );
}
