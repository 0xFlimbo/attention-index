import Link from "next/link";
import type { MediaReference } from "@/schemas/media.schema";
import { selectPublicationReferences } from "@/lib/metrics/media";
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
        A real list, not a div of divs, so assistive technology announces how
        many publications there are — same reasoning as `AmplifiedBy`'s grid.
      */}
      <ul className="mt-10 md:mt-14">
        {publications.map((entry) => (
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
