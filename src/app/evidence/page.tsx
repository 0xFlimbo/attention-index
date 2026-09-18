import type { Metadata } from "next";
import { ogImageDescriptor, twitterImageDescriptor } from "@/lib/og-image-meta";
import {
  getPosts,
  getAmplifications,
  getMediaReferences,
  getMilestones,
  getProjectMetadata,
} from "@/lib/data";
import { isVerifiedRecord } from "@/lib/data/eligibility";
import { selectArchivePosts } from "@/lib/metrics/archive";
import { selectAmplifiers } from "@/lib/metrics/amplification";
import { selectMediaReferences } from "@/lib/metrics/media";
import { formatCount } from "@/lib/format/number";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ExternalArrow } from "@/components/external-arrow";
import {
  EvidenceRecordRow,
  toAmplificationEvidenceRow,
  toMediaEvidenceRow,
  toPostEvidenceRow,
} from "@/components/evidence-record-row";

/**
 * docs/WORKPLAN.md B6 — same title/OG treatment as `/archive`: a short
 * `title` that reproduces the pre-B6 string through the root layout's
 * `template`, plus OG/Twitter fields.
 *
 * `images` explicit (B9) — see `src/app/archive/page.tsx`'s comment: a route
 * that declares its own `openGraph`/`twitter` object replaces the root's
 * already-resolved image rather than extending it, so every such route
 * repeats the pointer.
 */
const TITLE = "Evidence & Sources";
const DESCRIPTION =
  "Every verified record behind this project's derived metrics — posts, amplifications, media references and milestones — each linked to its public source.";

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
 * docs/HOMEPAGE.md §2 — "never render zeros ... to fill space". A populated
 * section states its derived count; an empty one is named only, and the
 * `No verified records yet.` line below it carries the message rather than a
 * heading and an empty state both saying "zero".
 */
function sectionHeading(name: string, count: number): string {
  if (count === 0) return name;
  return `${name} — ${formatCount(count)} ${count === 1 ? "record" : "records"}`;
}

/**
 * docs/ENGINEERING.md §6 — "browsable list of posts / amplifications /
 * media / milestones — a simple table is enough." Record-oriented, which is
 * what differentiates this route from `/archive`'s editorial view: every
 * row shows the record `id` alongside its human fields. Server Component,
 * zero client JS, no filters (that is `/archive`'s job).
 */
export default function EvidencePage() {
  const project = getProjectMetadata();

  const postRows = selectArchivePosts(getPosts());
  const amplificationRows = selectAmplifiers(getAmplifications());
  const mediaRows = selectMediaReferences(getMediaReferences());
  const milestoneRows = getMilestones().filter(isVerifiedRecord);

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
          Evidence &amp; Sources
        </h1>
        <p className="text-body mt-6 max-w-2xl text-ink-soft">
          Every verified record behind this project&apos;s derived metrics, listed with its
          source. Each row links to the public evidence it was verified against.
        </p>
        <p className="text-metadata mt-6 text-ink-soft">{project.disclaimer}</p>

        <section id="posts" className="mt-16 md:mt-20">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            {sectionHeading("Post data", postRows.length)}
          </h2>
          {postRows.length === 0 ? (
            <p className="text-body mt-6 text-ink-soft">No verified records yet.</p>
          ) : (
            <ul className="mt-6">
              {postRows.map(({ post }) => (
                <EvidenceRecordRow key={post.id} data={toPostEvidenceRow(post)} />
              ))}
            </ul>
          )}
        </section>

        <section id="amplifications" className="mt-16 md:mt-20">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            {sectionHeading("Amplifications", amplificationRows.length)}
          </h2>
          {amplificationRows.length === 0 ? (
            <p className="text-body mt-6 text-ink-soft">No verified records yet.</p>
          ) : (
            <ul className="mt-6">
              {amplificationRows.map((amplification) => (
                <EvidenceRecordRow
                  key={amplification.id}
                  data={toAmplificationEvidenceRow(amplification)}
                />
              ))}
            </ul>
          )}
        </section>

        <section id="media" className="mt-16 md:mt-20">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            {sectionHeading("Media", mediaRows.length)}
          </h2>
          {mediaRows.length === 0 ? (
            <p className="text-body mt-6 text-ink-soft">No verified records yet.</p>
          ) : (
            <ul className="mt-6">
              {mediaRows.map((reference) => (
                <EvidenceRecordRow key={reference.id} data={toMediaEvidenceRow(reference)} />
              ))}
            </ul>
          )}
        </section>

        <section id="milestones" className="mt-16 md:mt-20">
          <h2 className="text-lg font-bold tracking-tight text-ink">
            {sectionHeading("Milestones", milestoneRows.length)}
          </h2>
          {/*
            Milestones has zero verified records today (docs/WORKPLAN.md) — the
            exact empty-state string, never a fabricated row. The `.length`
            check (rather than a hardcoded empty state) keeps this section
            correct the moment `milestones.json` gets its first verified
            record, with no code change required.
          */}
          {milestoneRows.length === 0 ? (
            <p className="text-body mt-6 text-ink-soft">No verified records yet.</p>
          ) : (
            <ul className="mt-6">
              {milestoneRows.map((milestone) => (
                <li key={milestone.id} className="border-b border-line py-5 md:py-6">
                  <p className="text-record-id font-mono text-ink-soft">{milestone.id}</p>
                  <p className="text-body mt-1 font-semibold text-ink">{milestone.title}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/*
          docs/EDITORIAL.md §9's approved CTA vocabulary, buildable since the
          repository went public. Placed here rather than on /about (maintainer
          decision, 2026-09-18): this is the page where the intention forms —
          someone reading a record notices a wrong date or a missing source and
          the action is directly below it. On /about the same links reach a
          reader still working out what the project is, who has nothing to
          correct yet. Deliberately not in the footer: that list is site
          navigation at six entries already, and these are actions with a
          context, not destinations.

          CONTRIBUTE DATA points at CONTRIBUTING.md — which file to edit,
          evidence requirements, id conventions. SUBMIT A CORRECTION opens a new
          issue instead: a correction is a report about an existing record, not
          a pull request the reporter is expected to write, and CONTRIBUTING.md's
          own "Pull request expectations" lists exactly the fields (record,
          reason, old value, new value, evidence) an issue can carry.
        */}
        {project.repository_url !== null && (
          <section
            id="contribute"
            className="mt-16 border-t border-line pt-10 md:mt-20 lg:grid lg:grid-cols-12 lg:gap-x-10"
          >
            {/*
              Side-head at `lg`, the same 4 / 7 split and gap as `ProseSection`
              (src/components/prose-section.tsx). At 1440 this block sat in a
              `max-w-prose` column with the right half of its row empty, while
              the record lists and the rule above it span all twelve columns —
              the "narrow column beside a void" docs/DESIGN.md §5 rules out, and
              the same defect already corrected at the B2 hero, the B4 Crossover
              diagram, the B5 Evidence panel and the B6 prose pages. The grid is
              inline rather than `ProseSection` itself because this section keeps
              a top rule separating it from the records, and widening that
              component API for one caller buys less than two class strings.
              Below `lg` the markup is unchanged: heading stacked above body,
              which is the shape the 390 review approved.
            */}
            <h2 className="text-lg font-bold tracking-tight text-ink lg:col-span-4">
              Found something wrong?
            </h2>
            <div className="lg:col-span-7 lg:[&>*:first-child]:mt-0">
              <p className="text-body mt-4 max-w-prose text-ink-soft">
                Every record above is a file in the public repository. A missing record, a wrong
                date or a broken source link can be corrected by anyone — a public source is
                required for every new or changed fact.
              </p>
              <ul className="text-metadata mt-6 flex flex-wrap gap-x-8 gap-y-3 font-bold">
                <li>
                  <a
                    href={`${project.repository_url}/blob/main/CONTRIBUTING.md`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline-offset-2 hover:underline"
                  >
                    CONTRIBUTE DATA <ExternalArrow />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`${project.repository_url}/issues/new`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink underline-offset-2 hover:underline"
                  >
                    SUBMIT A CORRECTION <ExternalArrow />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              </ul>
            </div>
          </section>
        )}
      </main>
      <Footer project={project} />
    </div>
  );
}
