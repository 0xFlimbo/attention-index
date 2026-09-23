import Link from "next/link";
import type { Project } from "@/schemas/project.schema";
import { getAmplifications, getMediaReferences, getPosts } from "@/lib/data";
import { dataLastUpdated } from "@/lib/metrics/last-updated";
import { formatDate } from "@/lib/format/date";
import { ExternalArrow } from "./external-arrow";

/**
 * docs/HOMEPAGE.md §14, docs/EDITORIAL.md §8 — the site footer (section 11).
 * Server Component, rendered on all five routes as a sibling after
 * `</main>` (same per-page placement as `<Navigation />`, not lifted into
 * `layout.tsx`). Cream/soft-cream, a thin 1px top divider — no `border-t-2`
 * (docs/DESIGN.md §5 fixes borders at 1px; a prior batch's review had to
 * strip a heavier one here). No newsletter, no social icons, no CTA block.
 *
 * `DATA` links to the repository’s `data/` directory — the raw-data
 * destination docs/HOMEPAGE.md §14 always intended. It stood in at `/archive`
 * only while `repository_url` was `null` (B5 sign-off, explicitly temporary);
 * that stand-in expired when the repository was published. The `/archive`
 * branch is kept for the null case so the footer never renders a broken link
 * against a dataset without a repository.
 *
 * `id="site-footer"` exists so `pnpm check:visual --anchor site-footer` can
 * reach it: docs/ENGINEERING.md §16 makes a URL fragment the only way to
 * review a below-the-fold region without `fullPage`, and the footer is below
 * the fold on every route. No `scroll-margin-top` is needed — globals.css
 * scopes that rule to `section[id]`, and nothing above the footer needs to
 * stay visible when the footer itself is the anchor.
 *
 * `LAST DATA UPDATE` reads `dataLastUpdated` (src/lib/metrics/last-updated.ts),
 * not a project field — this Server Component loads posts, amplifications and
 * media directly (the loaders are cheap, module-cached reads, docs/DATA.md
 * §10) rather than adding three props every one of the five routes that
 * render this footer would otherwise have to drill through. `null` only when
 * the dataset holds no verified record anywhere; the whole stamp is omitted
 * rather than printing an invented date.
 */
interface FooterProps {
  project: Project;
}

export function Footer({ project }: FooterProps) {
  const lastUpdated = dataLastUpdated(getPosts(), getAmplifications(), getMediaReferences());

  return (
    <footer id="site-footer" className="border-t border-line bg-bg-soft">
      {/*
        From `lg` up the identity block and `LAST DATA UPDATE` sit on one row
        rather than stacking down the left edge of a 1376px container — the
        date reads as a masthead stamp and the footer stops leaving its whole
        right half empty. Below `lg` the order is exactly §14's: wordmark,
        statement, links, date.
      */}
      <div className="container-editorial flex flex-col gap-10 py-10 md:py-14 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <div>
          <p className="text-metadata font-bold uppercase text-ink">{project.project_name}</p>

          {/*
            `text-base` (a flat 18px), not `.text-body`, whose desktop clamp
            reaches 24px — §14 asks for a compact footer, and at 24px this
            statement was the largest thing in it. Unchanged at mobile, where
            `.text-body` is 18px too.
          */}
          <p className="text-base mt-4 max-w-2xl text-ink-soft">
            This website is an independent community-built project based on publicly available
            information. It is not operated by, affiliated with, or endorsed by LayoffHedge or{" "}
            {project.official_x_account}.
          </p>

          <nav
            aria-label="Footer"
            className="text-metadata mt-8 flex flex-wrap gap-x-6 gap-y-2 font-bold"
          >
            {project.repository_url !== null ? (
              <a
                href={`${project.repository_url}/tree/main/data`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline-offset-2 hover:underline"
              >
                DATA <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <Link href="/archive" className="text-ink underline-offset-2 hover:underline">
                DATA
              </Link>
            )}
            <Link href="/methodology" className="text-ink underline-offset-2 hover:underline">
              METHODOLOGY
            </Link>
            {project.repository_url !== null && (
              <a
                href={project.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline-offset-2 hover:underline"
              >
                GITHUB <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            <Link href="/evidence" className="text-ink underline-offset-2 hover:underline">
              SOURCES
            </Link>
            {/*
              Not in docs/HOMEPAGE.md §14's original link list — added at the B5
              sign-off and written back into §14. `/about` is a real route with no
              inbound link anywhere else: docs/HOMEPAGE.md §3 fixes the nav at
              ATTENTION / CROSSOVER / ARCHIVE / SOURCES / GITHUB, so the footer is
              the only site-map surface that can reach it.
            */}
            <Link href="/about" className="text-ink underline-offset-2 hover:underline">
              ABOUT
            </Link>
            <a
              href={project.official_project_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline-offset-2 hover:underline"
            >
              OFFICIAL LAYOFFHEDGE <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>

        {lastUpdated !== null && (
          <p className="text-metadata text-ink-soft lg:shrink-0 lg:text-right">
            LAST DATA UPDATE
            <br />
            <span className="font-bold text-ink">{formatDate(lastUpdated)}</span>
          </p>
        )}
      </div>

      <div aria-hidden="true" className="h-0.5 w-full bg-accent" />
    </footer>
  );
}
