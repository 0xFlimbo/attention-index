import type { Post } from "@/schemas/post.schema";
import type { Amplification } from "@/schemas/amplification.schema";
import type { MediaReference } from "@/schemas/media.schema";
import { AMPLIFICATION_ACTION_LABELS, AMPLIFICATION_CATEGORY_LABELS } from "@/lib/metrics/amplification";
import { formatCompactNumber } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { mediaReferenceDescriptors } from "@/lib/format/media-descriptors";
import { ExternalArrow } from "./external-arrow";

/**
 * docs/ENGINEERING.md §6 — `/evidence` is record-oriented: every row shows
 * the record `id` (mono) plus its human fields plus its evidence link. One
 * shared row shape for all four record kinds, already display-shaped (same
 * split as `ArchiveRow`/`toArchiveRowData` and `AmplifierCard`/
 * `toAmplifierCardData`: field selection and lookups happen in the mapper
 * below, formatting stays in the component) — deliberately not four
 * near-duplicate row components.
 */
export interface EvidenceRecordRowData {
  id: string;
  title: string;
  /** Short fields joined with " · "; already formatted, already filtered of nulls. */
  meta: string[];
  href: string;
  /**
   * "VIEW SOURCE" | "VIEW EVIDENCE" — docs/EDITORIAL.md §9 approved CTA
   * vocabulary. The label carries no glyph: the row appends `<ExternalArrow />`
   * itself, so the `↗` is aria-hidden rather than baked into a string a screen
   * reader would read out as a character (B9 accessibility pass).
   */
  linkLabel: string;
}

/**
 * docs/ENGINEERING.md §7 — every mutable metric (views) stays paired with
 * its own `observed_at`, never the record's `published_at`.
 */
export function toPostEvidenceRow(post: Post): EvidenceRecordRowData {
  return {
    id: post.id,
    title: post.subject ?? post.title,
    meta: [
      `Published ${formatDate(post.published_at)}`,
      `${formatCompactNumber(post.metrics.views)} views observed ${formatDate(post.metrics.observed_at)}`,
    ],
    href: post.url,
    linkLabel: "VIEW SOURCE",
  };
}

export function toAmplificationEvidenceRow(amplification: Amplification): EvidenceRecordRowData {
  const roleAndOrg = [amplification.role, amplification.organization].filter(
    (value): value is string => value !== null,
  );

  return {
    id: amplification.id,
    title: amplification.entity_name,
    meta: [
      ...roleAndOrg,
      AMPLIFICATION_ACTION_LABELS[amplification.action],
      AMPLIFICATION_CATEGORY_LABELS[amplification.category],
      formatDate(amplification.date),
    ],
    href: amplification.evidence_url,
    linkLabel: "VIEW EVIDENCE",
  };
}

/**
 * docs/ENGINEERING.md §7 — `author, country, context, logo, archive_url` are
 * all nullable; only non-null fields ever reach `meta`. This is the first
 * time media records reach the UI (B5), so there is no established display
 * shape to reuse.
 *
 * `mediaReferenceDescriptors` appends the B13 attributes (newsroom country,
 * the outlet a republication credits, and the featured criterion stated as
 * the fact it stands for). `/evidence` is the ledger where every verified
 * record is auditable, so a syndicated record appears here in full rather
 * than being quietly dropped from a page that claims to list everything —
 * what the provenance changes is the figures it feeds, not its visibility.
 */
export function toMediaEvidenceRow(reference: MediaReference): EvidenceRecordRowData {
  return {
    id: reference.id,
    title: reference.title,
    meta: [
      reference.publication,
      REFERENCE_TYPE_LABELS[reference.reference_type],
      formatDate(reference.published_at),
      ...(reference.author !== null ? [`By ${reference.author}`] : []),
      ...mediaReferenceDescriptors(reference),
    ],
    href: reference.url,
    linkLabel: "VIEW SOURCE",
  };
}

/**
 * Neutral, capitalized display labels for `MediaReferenceType` —
 * docs/EDITORIAL.md §9. Exported (not module-private) because
 * `MediaReferenceRow` (B8) needs the same labels for its expanded panel —
 * one definition, not a second copy.
 */
export const REFERENCE_TYPE_LABELS: Record<MediaReference["reference_type"], string> = {
  article: "Article",
  newsletter: "Newsletter",
  podcast: "Podcast",
  broadcast: "Broadcast",
  research: "Research",
  blog: "Blog",
  other: "Reference",
};

interface EvidenceRecordRowProps {
  data: EvidenceRecordRowData;
}

/**
 * Flat, full-width line — never a card (docs/DESIGN.md §6 "Archive row"
 * precedent). Stacks below `md`; the id/title/meta column and the evidence
 * link sit side by side from `md` up.
 */
export function EvidenceRecordRow({ data }: EvidenceRecordRowProps) {
  return (
    <li className="flex flex-col gap-2 border-b border-line py-5 md:flex-row md:items-start md:justify-between md:gap-6 md:py-6">
      <div className="min-w-0">
        {/* `.text-record-id`, not `.text-metadata`: ids print verbatim — see globals.css. */}
        <p className="text-record-id font-mono text-ink-soft">{data.id}</p>
        <p className="text-body mt-1 font-semibold text-ink">{data.title}</p>
        {data.meta.length > 0 && (
          <p className="text-metadata mt-1 text-ink-soft">{data.meta.join(" · ")}</p>
        )}
      </div>
      <a
        href={data.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-metadata shrink-0 font-bold text-ink underline-offset-2 hover:underline md:pt-1"
      >
        {data.linkLabel} <ExternalArrow />
        <span className="sr-only"> for {data.title}</span>
      </a>
    </li>
  );
}
