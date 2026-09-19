import type { PublicationReferences } from "@/lib/metrics/media";
import { REFERENCE_TYPE_LABELS } from "./evidence-record-row";
import { formatCount } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { mediaReferenceDescriptors } from "@/lib/format/media-descriptors";
import { ExternalArrow } from "./external-arrow";

/** One reference inside an expanded publication row, already field-selected for display. */
export interface MediaReferenceEntryData {
  id: string;
  title: string;
  referenceTypeLabel: string;
  publishedAt: string;
  author: string | null;
  /**
   * docs/WORKPLAN.md B13 — newsroom country, the outlet a republication
   * credits, and the featured criterion, already resolved to words by
   * `mediaReferenceDescriptors` and joined into the same metadata line as
   * the type, date and author. Nothing here is a badge or a glyph.
   */
  descriptors: string[];
  context: string | null;
  url: string;
}

/**
 * docs/DESIGN.md §6 "Media reference row" — one publication per row, its
 * derived reference count, and the eligible references themselves (already
 * sorted by `selectPublicationReferences`) for the expanded panel. Field
 * selection and lookups happen here, matching the `ArchiveRow` /
 * `toArchiveRowData` and `EvidenceRecordRow` precedent; formatting
 * (`formatCount`, `formatDate`) stays in the component.
 */
export interface MediaReferenceRowData {
  publication: string;
  count: number;
  references: MediaReferenceEntryData[];
}

export function toMediaReferenceRowData(entry: PublicationReferences): MediaReferenceRowData {
  return {
    publication: entry.publication,
    count: entry.references.length,
    references: entry.references.map((reference) => ({
      id: reference.id,
      title: reference.title,
      referenceTypeLabel: REFERENCE_TYPE_LABELS[reference.reference_type],
      publishedAt: reference.published_at,
      author: reference.author,
      descriptors: mediaReferenceDescriptors(reference),
      context: reference.context,
      url: reference.url,
    })),
  };
}

interface MediaReferenceRowProps {
  row: MediaReferenceRowData;
}

/**
 * docs/DESIGN.md §6 "Archive row" — flat, full-width line, `border-b
 * border-line`, never a card. Reuses `ArchiveRow`'s exact `<details>/
 * <summary>` pattern (and its `.archive-row` / `.archive-row-toggle` CSS
 * selectors, both generic enough to apply here unchanged) for the same
 * reasons: zero-JS, keyboard-accessible expansion, and nothing hover-only on
 * mobile (docs/HOMEPAGE.md §15).
 *
 * B13 leaves this summary line exactly as it was. The publication name and
 * `N references` are unchanged, and the provenance and featured facts live
 * inside the panel instead: the right rail is `shrink-0 whitespace-nowrap`,
 * so anything added there widens a fixed column and is the first thing to
 * overflow at 390px. Prominence is carried by the group order
 * (`selectPublicationReferences`) and by the words in each reference's own
 * metadata line — never by a marker on the row.
 *
 * Planner decision (B8 brief): no row-level `↗`. docs/HOMEPAGE.md §11's
 * sketch shows one at the end of the publication line, but a publication
 * with more than one reference has no single correct destination — picking
 * one would silently misattribute the row to a single article. §11 itself
 * anticipates the expansion ("Click may expand article title, date, URL and
 * context"), so every reference gets its own `VIEW SOURCE ↗` inside the
 * panel instead, and the summary line carries no link of its own.
 */
export function MediaReferenceRow({ row }: MediaReferenceRowProps) {
  // Hover parity with `ArchiveRow`: both are expandable flat rows, and on the
  // homepage this section sits directly under the Viral Archive — a row that
  // stays inert while the identical-looking row above it responds reads as
  // dead. docs/DESIGN.md §6: "Hover may shift the surface color slightly — no
  // lift effect."
  return (
    <div className="archive-row border-b border-line py-5 transition-colors duration-300 hover:bg-bg-soft md:py-6">
      <details>
        {/*
          `min-w-0 flex-1` on the publication name lets it wrap/shrink inside
          the flex row instead of forcing horizontal overflow at 390px — a
          long name ("Forbes (Digital Assets)") has nowhere else to go, and
          `ArchiveRow`'s subject column comment already rules out `truncate`
          for the same reason: there is no other place on the page to read
          the full text.
        */}
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4">
          <span className="text-body min-w-0 flex-1 font-bold text-ink">{row.publication}</span>
          <span className="flex shrink-0 items-baseline gap-4">
            <span className="text-metadata whitespace-nowrap text-ink-soft">
              {formatCount(row.count)} {row.count === 1 ? "reference" : "references"}
            </span>
            <span
              aria-hidden="true"
              className="archive-row-toggle font-mono text-metadata w-4 text-center text-ink-soft"
            />
          </span>
        </summary>

        <ul className="archive-row-detail mt-4 space-y-5 pb-2 md:pl-12">
          {row.references.map((reference) => (
            /*
              The record id doubles as the element id, so a single reference is
              linkable on its own (`/#media-newsweek-2026-08-12`) — the same id
              `/evidence` prints verbatim, which is the one a reader can find in
              `data/media.json`. `.media-reference-entry` carries the sticky-nav
              scroll offset that `section[id]` already gets in globals.css.
            */
            <li
              key={reference.id}
              id={reference.id}
              className="media-reference-entry flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">{reference.title}</p>
                <p className="text-metadata mt-1 text-ink-soft">
                  {[
                    reference.referenceTypeLabel,
                    formatDate(reference.publishedAt),
                    ...(reference.author !== null ? [`By ${reference.author}`] : []),
                    ...reference.descriptors,
                  ].join(" · ")}
                </p>
                {reference.context !== null && (
                  <p className="text-body mt-2 text-ink-soft">{reference.context}</p>
                )}
              </div>
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-metadata shrink-0 font-bold text-ink underline-offset-2 hover:underline md:pt-1"
              >
                VIEW SOURCE <ExternalArrow /><span className="sr-only"> for {reference.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
