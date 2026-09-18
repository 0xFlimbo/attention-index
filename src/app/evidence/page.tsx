import type { Metadata } from "next";
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
import {
  EvidenceRecordRow,
  toAmplificationEvidenceRow,
  toMediaEvidenceRow,
  toPostEvidenceRow,
} from "@/components/evidence-record-row";

/**
 * docs/WORKPLAN.md B6 — same title/OG treatment as `/archive`: a short
 * `title` that reproduces the pre-B6 string through the root layout's
 * `template`, plus text-only OG/Twitter fields (no image; deferred to B9).
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
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — LayoffHedge Attention Index`,
    description: DESCRIPTION,
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
      </main>
      <Footer project={project} />
    </div>
  );
}
