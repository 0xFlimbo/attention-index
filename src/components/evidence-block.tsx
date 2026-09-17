import Link from "next/link";
import type { Post } from "@/schemas/post.schema";
import type { Amplification } from "@/schemas/amplification.schema";
import type { MediaReference } from "@/schemas/media.schema";
import type { Milestone } from "@/schemas/milestone.schema";
import { selectDatasetSummary } from "@/lib/metrics/dataset";
import { formatCount } from "@/lib/format/number";
import { SectionEyebrow } from "./section-eyebrow";

/**
 * docs/HOMEPAGE.md §12 — Evidence / Sources (section 09, thematic eyebrow
 * "06" per docs/DESIGN.md §6's list). Self-contained Server Component, same
 * shape as `ViralArchive`/`CrossoverMap`: owns its own eyebrow, headline and
 * `id="evidence"`.
 *
 * Structure is a cream section holding a dark panel (`--color-panel-dark`)
 * — the contrast device §12 asks for, never a dark site. Measured contrast
 * on `--color-panel-dark` (#1E1E1E), docs/DESIGN.md §11 style:
 *   --color-accent (#E34B46)          4.24:1  — large text only (>=24px bold
 *                                                or >=18.66px bold)
 *   --color-panel-dark-text (#F3F0EA) 14.7:1  — fine everywhere
 *   --color-line-strong (#CFC8BE)     10.1:1  — fine everywhere, used here
 *                                                for the quieter dataset rows
 * `VERIFY THEM.` is display-size (`text-2xl`/`text-3xl`, well above the
 * large-text floor), so the accent red is safe there; no other copy inside
 * the panel uses accent on a small size.
 */
interface EvidenceBlockProps {
  posts: Post[];
  amplifications: Amplification[];
  mediaReferences: MediaReference[];
  milestones: Milestone[];
  repositoryUrl: string | null;
}

export function EvidenceBlock({
  posts,
  amplifications,
  mediaReferences,
  milestones,
  repositoryUrl,
}: EvidenceBlockProps) {
  const rows = selectDatasetSummary({ posts, amplifications, mediaReferences, milestones });

  return (
    <section id="evidence" className="container-editorial section-padding reveal-on-mount">
      <SectionEyebrow index="06" label="EVIDENCE" />

      <div className="bg-panel-dark text-panel-dark-text mt-6 px-6 py-12 md:px-12 md:py-16">
        {/*
          From `lg` up the statement (columns 1–6) and the dataset table
          (7–12) share one 12-column row. Without it the panel is 1376px wide
          at 1440 while its content sits in a ~672px column on the left, which
          is the "narrow column beside a void" docs/DESIGN.md §5 rules out for
          a key section — the same correction, for the same reason, as the B2
          hero and the B4 Crossover diagram. Below `lg` everything stacks in
          DOM order: statement, table, CTAs.
        */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-6">
            {/*
              32px at 390: `THE NUMBERS.` does not fit on one line at 48px in
              the padded panel, and the approved copy's own line breaks are
              the point — a headline that rewraps itself to `THE / NUMBERS.`
              is not the approved copy. Still far above the large-text
              contrast floor the accent red needs (>=18.66px bold).
            */}
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">
              DON&apos;T TRUST
              <br />
              THE NUMBERS.
              <br />
              <span className="text-accent">VERIFY THEM.</span>
            </h2>

            <p className="text-body mt-6 max-w-prose text-panel-dark-text">
              Every major claim on this website links back to publicly accessible evidence or
              source data.
            </p>
          </div>

          <div className="mt-10 md:mt-14 lg:col-span-6 lg:col-start-7 lg:mt-0">
            {/*
              A real <table>: this is tabular data (docs/HOMEPAGE.md §12 draws
              it as a table), and a table aligns its columns natively. The
              earlier flex row could not — `justify-between` positions the
              middle child from the free space left by its siblings, so the
              count drifted with each label's width and the four numbers read
              ragged at every width. It also makes the zero-count row's empty
              link cell just an empty cell, with no placeholder needed.
            */}
            <table className="w-full">
              <caption className="sr-only">
                Records in each dataset behind this project&apos;s metrics
              </caption>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-line-strong first:border-t-0">
                    <th
                      scope="row"
                      className="text-metadata py-4 text-left font-bold text-panel-dark-text"
                    >
                      {row.label}
                    </th>
                    <td className="text-metadata py-4 pl-6 text-right whitespace-nowrap text-line-strong">
                      {formatCount(row.count)} {row.count === 1 ? "RECORD" : "RECORDS"}
                    </td>
                    <td className="text-metadata py-4 pl-6 text-right font-bold">
                      {row.href !== null && (
                        <Link
                          href={row.href}
                          className="text-panel-dark-text underline-offset-2 hover:underline"
                        >
                          {/* Internal route — → not ↗ (docs/DESIGN.md §6 reserves ↗ for external links). */}
                          VIEW →
                          {/*
                            docs/EDITORIAL.md §9 — "link text must make sense out of
                            context". Four links all reading "VIEW →" do not; the
                            label disambiguates them in a screen reader's link list.
                          */}
                          <span className="sr-only"> {row.label} records</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-metadata mt-10 flex flex-wrap gap-x-8 gap-y-3 font-bold md:mt-14">
              <Link
                href="/archive"
                className="text-panel-dark-text underline-offset-2 hover:underline"
              >
                VIEW DATA →
              </Link>
              <Link
                href="/evidence"
                className="text-panel-dark-text underline-offset-2 hover:underline"
              >
                VIEW SOURCES →
              </Link>
              <Link
                href="/methodology"
                className="text-panel-dark-text underline-offset-2 hover:underline"
              >
                VIEW METHODOLOGY →
              </Link>
              {repositoryUrl !== null && (
                <a
                  href={repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-panel-dark-text underline-offset-2 hover:underline"
                >
                  GITHUB ↗<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
