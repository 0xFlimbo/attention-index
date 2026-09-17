import Link from "next/link";
import type { Post } from "@/schemas/post.schema";
import { selectArchivePosts, HOMEPAGE_ARCHIVE_ROW_COUNT } from "@/lib/metrics/archive";
import { ArchiveRow, toArchiveRowData } from "./archive-row";
import { SectionEyebrow } from "./section-eyebrow";

/**
 * docs/HOMEPAGE.md §10 — Viral Archive (section 07, thematic eyebrow "04").
 * Approved copy verbatim. No filters here — the homepage only ever shows
 * `HOMEPAGE_ARCHIVE_ROW_COUNT` of the strongest rows; `/archive` (B3, same
 * batch) is the full, filterable database view. Server Component: nothing
 * here needs client interaction, so none is added.
 */
interface ViralArchiveProps {
  posts: Post[];
}

export function ViralArchive({ posts }: ViralArchiveProps) {
  const rows = selectArchivePosts(posts).slice(0, HOMEPAGE_ARCHIVE_ROW_COUNT);

  return (
    <section id="archive" className="container-editorial section-padding reveal-on-mount">
      <SectionEyebrow index="04" label="VIRAL ARCHIVE" />
      <h2 className="text-2xl md:text-3xl mt-4 font-bold tracking-tight text-ink">
        THE POSTS
        <br />
        THAT TRAVELLED.
      </h2>

      <div className="mt-10 md:mt-14">
        {rows.map(({ post, rank }) => (
          <ArchiveRow key={post.id} row={toArchiveRowData(post, rank)} />
        ))}
      </div>

      <Link
        href="/archive"
        className="text-metadata mt-10 inline-block font-bold text-ink underline-offset-2 hover:underline md:mt-14"
      >
        {/* Internal route, not an external source — no ↗ glyph (docs/DESIGN.md §6 reserves it for external links). */}
        OPEN ARCHIVE →
      </Link>
    </section>
  );
}
