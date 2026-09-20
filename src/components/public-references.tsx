import Link from "next/link";
import type { MediaReference } from "@/schemas/media.schema";
import {
  getMediaMetrics,
  selectPublicationReferences,
  HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT,
} from "@/lib/metrics/media";
import { formatCount } from "@/lib/format/number";
import { MediaReferenceRow, toMediaReferenceRowData } from "./media-reference-row";
import { SectionEyebrow } from "./section-eyebrow";

/**
 * docs/HOMEPAGE.md §11 — Public References (section 08, thematic eyebrow
 * "05"). Self-contained Server Component, same shape as `ViralArchive` /
 * `CrossoverMap` / `AmplifiedBy`: owns its own eyebrow/headline/supporting
 * copy and decides its own visibility. Renders once there is at least one
 * eligible publication row — docs/HOMEPAGE.md §2 sets the bar at "≥1
 * verified media record", not the 3-record grid minimum `AmplifiedBy` uses
 * (that threshold exists because that section is a *grid*; this one is
 * rows, so a single row is still a legitimate section).
 *
 * Planner decision (B8 brief): no marquee. docs/HOMEPAGE.md §11 allows "at
 * most one slow marquee… only if enough recognizable [publications] exist",
 * but `globals.css` documents the homepage's motion budget as exactly three
 * effects and `CLAUDE.md` requires restrained motion; a fifth is deferred to
 * B9, which owns the motion audit, not decided ad hoc here.
 */
interface PublicReferencesProps {
  mediaReferences: MediaReference[];
}

export function PublicReferences({ mediaReferences }: PublicReferencesProps) {
  const publications = selectPublicationReferences(mediaReferences);
  if (publications.length === 0) return null;

  const rows = publications.slice(0, HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT);
  const hiddenCount = publications.length - rows.length;

  // Both figures are derived on this render and neither is written down
  // anywhere: `countryCount` is the same value `/methodology` prints, over
  // original references only (docs/DATA.md §10), and the group count is the
  // length of the list immediately below. Each sentence disappears when it
  // has nothing true to say — no country on any record, or nothing capped.
  const { countryCount } = getMediaMetrics(mediaReferences);

  return (
    <section id="references" className="container-editorial section-padding">
      <SectionEyebrow index="05" label="PUBLIC REFERENCES" />
      <h2 className="text-2xl md:text-3xl mt-4 font-bold tracking-tight text-ink">
        IT DIDN&apos;T
        <br />
        STOP AT X.
      </h2>
      <p className="text-body mt-4 max-w-2xl text-ink-soft">
        Documented references across publications, journalism, broadcasts, research, and other
        public sources.
      </p>
      {/*
        docs/WORKPLAN.md B19 — the country figure is a sentence in the
        supporting copy, never a stat cell: this section carries no dominant
        number (docs/WORKPLAN.md "Decisions already made"), and a display-size
        numeral here would compete with the Primary Attention Metric. The
        capped-list sentence sits beside it so the cap is stated rather than
        silent: without it the section drops most of the list without a word,
        and forty of the fifty-one rows hold a single reference each, so what
        a cap hides is mostly the long tail rather than the dense groups.
      */}
      {(countryCount > 0 || hiddenCount > 0) && (
        <p className="text-body mt-3 max-w-2xl text-ink-soft">
          {countryCount > 0 && (
            <>
              References from newsrooms in {formatCount(countryCount)}{" "}
              {countryCount === 1 ? "country" : "countries"}.{" "}
            </>
          )}
          {hiddenCount > 0 && (
            <>
              Showing {formatCount(rows.length)} of {formatCount(publications.length)}{" "}
              publications; every reference is listed on the evidence page.
            </>
          )}
        </p>
      )}

      {/*
        A real list, not a div of divs, so assistive technology announces how
        many publications there are — same reasoning as `AmplifiedBy`'s grid.
      */}
      <ul className="mt-10 md:mt-14">
        {rows.map((entry) => (
          <li key={entry.publication}>
            <MediaReferenceRow row={toMediaReferenceRowData(entry)} />
          </li>
        ))}
      </ul>

      <Link
        href="/evidence"
        className="text-metadata mt-10 inline-block font-bold text-ink underline-offset-2 hover:underline md:mt-14"
      >
        {/* Internal route, not an external source — no ↗ glyph (docs/DESIGN.md §6 reserves it for external links). */}
        OPEN EVIDENCE →
      </Link>
    </section>
  );
}
