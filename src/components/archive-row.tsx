import type { Post } from "@/schemas/post.schema";
import { PLATFORM_LABELS } from "@/lib/metrics/attention-grid";
import { formatCompactNumber, formatCount } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { SourceFooter } from "./source-footer";

/**
 * docs/DESIGN.md §6 / docs/HOMEPAGE.md §10 — one archive row's data, already
 * shaped for display (formatting stays in the component; this is field
 * selection). Deliberately not `Post` itself, so `ArchiveRow` (and the
 * client-side sticky preview it feeds on `/archive`) never depends on the
 * schema shape — a plain, serializable view model.
 */
export interface ArchiveRowData {
  id: string;
  rank: number;
  views: number;
  subject: string;
  publishedAt: string;
  url: string;
  platformLabel: string;
  summary: string | null;
  observedAt: string;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
}

/** `post.subject` falls back to `post.title` — docs/DATA.md allows a null `subject`. */
export function toArchiveRowData(post: Post, rank: number): ArchiveRowData {
  return {
    id: post.id,
    rank,
    views: post.metrics.views,
    subject: post.subject ?? post.title,
    publishedAt: post.published_at,
    url: post.url,
    platformLabel: PLATFORM_LABELS[post.platform] ?? "Source",
    summary: post.summary,
    observedAt: post.metrics.observed_at,
    likes: post.metrics.likes,
    reposts: post.metrics.reposts,
    replies: post.metrics.replies,
  };
}

interface ArchiveRowProps {
  row: ArchiveRowData;
  /**
   * Set only by the `/archive` client preview (`archive-explorer.tsx`) on
   * hover/focus. Left undefined for the homepage's plain Server-rendered
   * usage — `ArchiveRow` itself stays a shared component with no
   * `"use client"` of its own; only a caller that is already a Client
   * Component may pass a real function here (docs/ENGINEERING.md §2).
   */
  onPreview?: () => void;
}

/**
 * docs/DESIGN.md §6 "Archive row" — flat, full-width line, never a card.
 * Structure: `INDEX · VIEWS · SUBJECT · DATE · SOURCE`. The source link is a
 * sibling of the `<details>`, not nested inside `<summary>`, so it (a) stays
 * visible at every width and in both the open and closed state, per this
 * batch's brief, and (b) never conflicts with the browser's native
 * click-to-toggle behavior on `<summary>`, which would otherwise also fire
 * for a link nested inside it. The `<details>/<summary>` gives every row a
 * zero-JS, keyboard-accessible expansion for the metrics/date/source panel —
 * required so the archive stays useful without JavaScript
 * (docs/ENGINEERING.md §2) and so no row's metadata is hover-only on mobile
 * (docs/HOMEPAGE.md §15). The `.archive-row-toggle` span is that expansion's
 * only visual affordance, since the browser default marker is suppressed in
 * globals.css; without it the row would look inert and the observation date
 * would be unreachable in practice on mobile.
 */
export function ArchiveRow({ row, onPreview }: ArchiveRowProps) {
  const index = String(row.rank).padStart(2, "0");
  const previewHandlers = onPreview !== undefined ? { onMouseEnter: onPreview, onFocus: onPreview } : {};

  return (
    <div
      className="archive-row flex items-start gap-4 border-b border-line py-5 transition-colors duration-300 hover:bg-bg-soft md:py-6"
      {...previewHandlers}
    >
      <details className="min-w-0 flex-1">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-2 md:flex-nowrap md:items-center md:gap-x-6">
          <span className="font-mono text-metadata w-8 shrink-0 text-ink-soft tabular-nums">
            {index}
          </span>
          <span className="text-body w-20 shrink-0 font-bold tabular-nums text-ink md:w-28">
            {formatCompactNumber(row.views)}
          </span>
          {/*
            No `truncate` at any width: between 768px and the preview split at
            1024px the subject column is only ~250px wide, and a longer subject
            ("Oracle layoffs and workplace culture") would be clipped with no
            other place on the page to read it — the detail panel below shows
            the summary, not the subject. It wraps instead; docs/DESIGN.md §6
            asks for generous row height anyway.
          */}
          <span className="text-body order-last w-full font-semibold text-ink md:order-none md:w-auto md:min-w-0 md:flex-1">
            {row.subject}
          </span>
          {/*
            Below `md` the summary wraps, and the published date drops under the
            subject rather than competing with it for the first line: at 390px
            index + views + date + the toggle do not fit beside each other, and
            leaving them to wrap on their own stranded the toggle alone on a line
            of its own, where it read as a stray character instead of a control.
          */}
          <span className="text-metadata order-last shrink-0 text-ink-soft md:order-none">
            {formatDate(row.publishedAt)}
          </span>
          <span
            aria-hidden="true"
            className="archive-row-toggle font-mono text-metadata ml-auto w-4 shrink-0 text-center text-ink-soft"
          />
        </summary>

        <div className="archive-row-detail mt-4 max-w-2xl space-y-4 pb-2 md:pl-12">
          {row.summary !== null && <p className="text-body text-ink-soft">{row.summary}</p>}

          {(row.likes !== null || row.reposts !== null || row.replies !== null) && (
            <dl className="text-metadata flex flex-wrap gap-x-6 gap-y-2 text-ink-soft">
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

          <SourceFooter sources={[row.platformLabel]} observedAt={row.observedAt} />
        </div>
      </details>

      {/*
        Stays top-aligned at every width: `self-center` would drop the link into
        the vertical middle of an expanded row, far from the line it belongs to.
      */}
      <a
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-metadata shrink-0 self-start pt-1 font-bold text-ink underline-offset-2 hover:underline"
      >
        VIEW SOURCE ↗<span className="sr-only"> for {row.subject}</span>
      </a>
    </div>
  );
}
