import type { Metadata } from "next";
import { ogImageDescriptor, twitterImageDescriptor } from "@/lib/og-image-meta";
import Link from "next/link";
import { getProjectMetadata } from "@/lib/data";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ProseSection } from "@/components/prose-section";
import { ExternalArrow } from "@/components/external-arrow";

/**
 * docs/WORKPLAN.md B6 — real content, replacing the B2 placeholder. Title
 * stays short; `src/app/layout.tsx`'s template appends the site suffix,
 * reproducing the exact string this route shipped before B6.
 *
 * `images` explicit (B9) — see `src/app/archive/page.tsx`'s comment: a route
 * that declares its own `openGraph`/`twitter` object replaces the root's
 * already-resolved image rather than extending it, so every such route
 * repeats the pointer.
 */
const TITLE = "About";
const DESCRIPTION =
  "What the LayoffHedge Attention Index is, why it exists, and how it is independent from LayoffHedge.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: `${TITLE} — LayoffHedge Attention Index`,
    description: DESCRIPTION,
    type: "website",
    siteName: "LayoffHedge Attention Index",
    images: [ogImageDescriptor],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — LayoffHedge Attention Index`,
    description: DESCRIPTION,
    images: [twitterImageDescriptor],
  },
};

/**
 * docs/EDITORIAL.md §8 holds an approved draft for this page — refined here,
 * not replaced with invented biography. There is no named maintainer
 * anywhere in this repo, so this page never names, implies, or describes one
 * beyond "the maintainer" / "an independent community project" (batch brief).
 * The GitHub link stays conditional on `repository_url`, matching the exact
 * pattern `Footer`/`Navigation` already use — no new pattern invented for one
 * page.
 */
export default function AboutPage() {
  const project = getProjectMetadata();

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">About</h1>

        <p className="text-body mt-6 max-w-prose text-ink-soft">
          The LayoffHedge Attention Index is an independent, community-built project that
          documents the public reach and crossover of LayoffHedge using publicly available
          evidence.
        </p>

        <ProseSection id="independence" heading="Independence">
          <p className="text-body mt-6 max-w-prose text-ink-soft">{project.disclaimer}</p>
          <p className="text-body mt-4 max-w-prose text-ink-soft">
            This website is not operated by, affiliated with, or endorsed by LayoffHedge or{" "}
            {project.official_x_account}. It is not a token landing page, a crypto dashboard, or an
            official LayoffHedge property. Nothing on this site should be read as investment
            advice, a price target, or a claim about LayoffHedge&apos;s value.
          </p>
        </ProseSection>

        <ProseSection id="why-this-exists" heading="Why this exists">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            The project began from a simple observation: one of the most unusual parts of
            LayoffHedge is not the existence of a crypto token, but the amount of attention the
            project has generated outside crypto — reaching journalists, public officials and
            general-interest media.
          </p>
          <p className="text-body mt-4 max-w-prose text-ink-soft">
            This site attempts to document that attention in a transparent, source-driven,
            open-source format: every headline number on this site is calculated from individual
            records, and every record links to the public evidence it was checked against. See{" "}
            <Link
              href="/methodology"
              className="font-bold text-ink underline-offset-2 hover:underline"
            >
              Methodology
            </Link>{" "}
            for exactly how.
          </p>
        </ProseSection>

        <ProseSection id="open-source" heading="Open source">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            The dataset and the code that renders it are open and inspectable, not a black box.
            Every record behind every metric on this site is a file in the public repository, and
            the same records are also browsable directly at{" "}
            <Link href="/evidence" className="font-bold text-ink underline-offset-2 hover:underline">
              Evidence &amp; Sources
            </Link>{" "}
            and{" "}
            <Link href="/archive" className="font-bold text-ink underline-offset-2 hover:underline">
              Viral Archive
            </Link>
            .
          </p>
          {/*
            `.text-metadata`, not `.text-body`: this is a CTA in the same register
            as /evidence's CONTRIBUTE DATA / SUBMIT A CORRECTION row, not a
            sentence. It shipped at body size and was flagged at the B9 visual
            review, where it stood out once the CTA block moved to /evidence and
            left it alone here.
          */}
          {project.repository_url !== null && (
            <p className="text-metadata mt-4 max-w-prose text-ink-soft">
              <a
                href={project.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-ink underline-offset-2 hover:underline"
              >
                VIEW ON GITHUB <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
        </ProseSection>

        <ProseSection id="official-links" heading="Official LayoffHedge links">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            This project is independent of LayoffHedge, but it tracks a real, official project.
            The official links below are LayoffHedge&apos;s own, not this project&apos;s:
          </p>
          <ul className="text-metadata mt-6 flex flex-wrap gap-x-8 gap-y-3 font-bold">
            <li>
              <a
                href={project.official_project_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline-offset-2 hover:underline"
              >
                OFFICIAL LAYOFFHEDGE <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            {/*
              The handle must print exactly as `project.json` stores it. This
              list carries `.text-metadata`, whose `text-transform: uppercase`
              the child inherits — it would render `@LAYOFFAI`, a handle that
              is not the account's name. `.text-record-id` is the same
              metadata scale with the uppercasing removed (docs/DESIGN.md §4),
              so the line keeps its size beside its siblings and the value
              stays verbatim. Same class, same reason, as the record ids on
              `/evidence`; a `normal-case` utility would lose here, exactly as
              it did in B5.
            */}
            <li className="text-ink-soft">
              Official X account:{" "}
              <span className="text-record-id text-ink">{project.official_x_account}</span>
            </li>
          </ul>
        </ProseSection>

        <ProseSection id="where-next" heading="Where to go next">
          <ul className="text-metadata mt-6 flex flex-wrap gap-x-8 gap-y-3 font-bold">
            <li>
              {/* `OPEN ARCHIVE →` is the label this site already uses for this
                  destination (src/components/viral-archive.tsx) and the phrasing
                  docs/EDITORIAL.md §9 approves — not a second name for one page. */}
              <Link href="/archive" className="text-ink underline-offset-2 hover:underline">
                OPEN ARCHIVE →
              </Link>
            </li>
            <li>
              <Link href="/evidence" className="text-ink underline-offset-2 hover:underline">
                VIEW EVIDENCE →
              </Link>
            </li>
            <li>
              <Link href="/methodology" className="text-ink underline-offset-2 hover:underline">
                VIEW METHODOLOGY →
              </Link>
            </li>
          </ul>
        </ProseSection>
      </main>
      <Footer project={project} />
    </div>
  );
}
