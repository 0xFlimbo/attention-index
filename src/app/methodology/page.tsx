import type { Metadata } from "next";
import { ogImageDescriptor, twitterImageDescriptor } from "@/lib/og-image-meta";
import Link from "next/link";
import { getPosts, getAmplifications, getMediaReferences, getProjectMetadata } from "@/lib/data";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { getAmplificationMetrics } from "@/lib/metrics/amplification";
import { getMediaMetrics } from "@/lib/metrics/media";
import { formatCount } from "@/lib/format/number";
import { formatDate, formatDateLong } from "@/lib/format/date";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ProseSection } from "@/components/prose-section";

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
const TITLE = "Methodology";
const DESCRIPTION =
  "How this project observes views, verifies records and calculates every derived number on the site — source definitions, limitations and the contribution workflow.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: `${TITLE} — LayoffHedge Attention Index`,
    description: DESCRIPTION,
    type: "article",
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
 * docs/ENGINEERING.md §6 requires this page to explain: source definitions,
 * observation dates, view-count limitations, what verification means,
 * derived metric definitions, the double-counting caveat, the contribution
 * model, and what data is unavailable. Statically authored prose, not
 * generated from code (§6) — but every *number* on the page is still a live
 * read from the same loaders and metric functions the rest of the site uses
 * (CLAUDE.md §3, "headline metrics are derived, never hardcoded"), so this
 * page can never quietly drift out of sync with the dataset it describes.
 */
export default function MethodologyPage() {
  const project = getProjectMetadata();
  const posts = getPosts();
  const amplifications = getAmplifications();
  const mediaReferences = getMediaReferences();

  const attention = getAttentionMetrics(posts);
  const amplificationMetrics = getAmplificationMetrics(amplifications);
  const mediaMetrics = getMediaMetrics(mediaReferences);

  // Records held at `needs_review` are real rows in the dataset, just not yet
  // public — stating how many exist is honest, not a fabricated number, and
  // it is derived the same way `isVerifiedRecord` is (never `.length` alone).
  const mediaNeedsReviewCount = mediaReferences.filter(
    (reference) => reference.status === "needs_review" && reference._placeholder !== true,
  ).length;

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">Methodology</h1>
        <p className="text-body mt-6 max-w-prose text-ink-soft">
          This page explains how records enter this dataset, what a recorded view count does and
          does not mean, what &quot;verified&quot; means on this project, and exactly how every
          derived number shown on this site is calculated.
        </p>
        <p className="text-metadata mt-6 text-ink-soft">{project.disclaimer}</p>

        <ProseSection id="sources" heading="What this project tracks">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            The dataset behind this site is four record types, each in its own file:
          </p>
          <ul className="text-body mt-6 max-w-prose space-y-4 text-ink-soft">
            <li>
              <strong className="text-ink">Tracked posts</strong> — public posts published by
              @LayoffAI, each paired with a manually recorded snapshot of its public view counter.
            </li>
            <li>
              <strong className="text-ink">Amplifications</strong> — public reposts, quote posts,
              replies, mentions, citations and interviews by named people or organizations outside
              the LayoffHedge account itself.
            </li>
            <li>
              <strong className="text-ink">Media references</strong> — external articles,
              newsletters, podcasts, broadcasts and other public coverage that mentions LayoffHedge
              or @LayoffAI.
            </li>
            <li>
              <strong className="text-ink">Milestones</strong> — editorial notes marking a
              specific, dated event in the project&apos;s public attention.
            </li>
          </ul>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            The archive is manually curated by the maintainer from publicly visible sources. It is
            not an automated crawl and does not claim to contain every public post, repost or
            article that exists about LayoffHedge — only the ones that have been found and
            verified.
          </p>
        </ProseSection>

        <ProseSection id="observation" heading="Observed views and observation dates">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            View counts on this site are not pulled from any private API or analytics dashboard.
            They are manually recorded from the public view counter visible on each X post, at a
            specific point in time.
          </p>

          {/* docs/ENGINEERING.md §6 — required verbatim statements. */}
          <div className="mt-8 max-w-prose space-y-3">
            <p className="text-body font-semibold text-ink">
              Observed views are public post-counter snapshots.
            </p>
            <p className="text-body font-semibold text-ink">They are not unique-user counts.</p>
            <p className="text-body font-semibold text-ink">
              The project does not have access to private LayoffHedge analytics.
            </p>
            <p className="text-body font-semibold text-ink">
              Inclusion in the archive documents public reach; it does not verify every claim
              inside a post.
            </p>
          </div>

          <p className="text-body mt-8 max-w-prose text-ink-soft">
            Because a public counter keeps changing after it is recorded, every stored view count
            is paired with the date it was observed — the day the snapshot was taken, not the day
            the post was published. A post&apos;s real, current count may be higher than the value
            shown here. A repost, quote post or citation recorded on this site is documented
            amplification, not proof that the person or organization amplifying it endorses,
            agrees with, or has independently verified any claim inside the original post.
          </p>
        </ProseSection>

        <ProseSection id="verification" heading={'What "verified" means'}>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Every record in this dataset carries one of three statuses:
          </p>
          <ul className="text-body mt-6 max-w-prose space-y-4 text-ink-soft">
            <li>
              <strong className="text-ink">Verified</strong> — the maintainer checked that the
              record&apos;s linked public source (the X post, article or filing) supports the
              record as written. This means the source was checked by the maintainer. It does{" "}
              <strong className="text-ink">not</strong> mean verified by X, audited by a third
              party, or endorsed by LayoffHedge in any way.
            </li>
            <li>
              <strong className="text-ink">Needs review</strong> — the record is incomplete,
              disputed, or not yet confirmed against its source. It is excluded from every public
              metric and every public list on this site.
            </li>
            <li>
              <strong className="text-ink">Archived</strong> — kept for the historical record (for
              example, a superseded or corrected entry) but excluded from current public metrics.
            </li>
          </ul>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Only records marked <strong className="text-ink">verified</strong>, and not marked as
            a development placeholder, feed any number shown on this website. As of{" "}
            {formatDateLong(project.data_last_updated)}, {formatCount(mediaMetrics.verifiedMediaReferenceCount)}{" "}
            of the {formatCount(mediaReferences.length)} imported media records are verified and
            visible on this site; {formatCount(mediaNeedsReviewCount)} remain at{" "}
            {/*
              `font-mono` alone, never `.text-record-id`: that class is the
              12px metadata scale (docs/DESIGN.md §4), and inside this 18–24px
              paragraph it would render the value at half the size of the text
              around it. Here the mono stack alone carries "this is a literal
              field value" while the word keeps the prose's own size.
            */}
            <span className="font-mono">needs_review</span>, pending manual confirmation, and are
            counted nowhere.
          </p>
        </ProseSection>

        <ProseSection id="metrics" heading="How the derived numbers are calculated">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Nothing on this site is stored as a summary. Every metric below is calculated from the
            current verified records at build time, using the same functions that render the
            homepage, the archive and the evidence pages.
          </p>

          <ul className="text-body mt-6 max-w-prose space-y-5 text-ink-soft">
            <li>
              <strong className="text-ink">TRACKED POSTS</strong> — the count of verified,
              non-placeholder posts. Today: {formatCount(attention.trackedPostCount)}.
            </li>
            <li>
              <strong className="text-ink">POSTS ABOVE 1M / 5M / 10M</strong> — the count of
              verified posts whose recorded view count is at least that threshold (inclusive,
              &ge;). Today: {formatCount(attention.postsOver1M)} above 1,000,000;{" "}
              {formatCount(attention.postsOver5M)} above 5,000,000;{" "}
              {formatCount(attention.postsOver10M)} above 10,000,000. The archive&apos;s filters
              and the homepage Attention Grid only ever offer a threshold when at least one
              verified post currently meets it — a threshold with zero matching records is never
              shown.
            </li>
            <li>
              <strong className="text-ink">MOST VIEWED TRACKED POST</strong> — the single verified
              post with the highest recorded view count. When two or more posts share the same
              view count, the tie is broken deterministically and in this order: the post{" "}
              published earliest wins; if the publish dates also match, the post whose record id
              sorts first, alphabetically, wins. This is the same ordering rule the Viral Archive
              uses for its row ranking, so &quot;the most viewed tracked post&quot; and archive row{" "}
              <strong className="text-ink">01</strong> are always provably the same record, never a
              coincidence of two separate implementations agreeing.
              {attention.topPost !== null && (
                <>
                  {" "}
                  Today that post has {formatCount(attention.topPost.views)} observed views,
                  recorded on {formatDateLong(attention.topPost.observedAt)}.
                </>
              )}
            </li>
            <li>
              <strong className="text-ink">OBSERVED VIEWS ACROSS TRACKED POSTS</strong> — the sum
              of every verified post&apos;s recorded view count. Today:{" "}
              {formatCount(attention.totalObservedViews)}. This total is a sum of per-post
              counters, not a count of people: the same person may appear in the counter of more
              than one tracked post, so this number is never a unique-audience figure and is never
              labeled as one.
            </li>
          </ul>

          <p className="text-body mt-8 max-w-prose text-ink-soft">
            Amplification and media counts follow the same rule — only verified, non-placeholder
            records. An amplifier is counted once as a{" "}
            <strong className="text-ink">unique amplifier</strong> no matter how many times they
            amplified the same account; today that resolves to{" "}
            {formatCount(amplificationMetrics.verifiedAmplificationCount)} verified amplifications
            from {formatCount(amplificationMetrics.uniqueAmplifierCount)} unique amplifiers, and{" "}
            {formatCount(mediaMetrics.verifiedMediaReferenceCount)} verified media references
            across {formatCount(mediaMetrics.uniquePublicationCount)} publications. Crossover
            category counts and Public References counts are the same style of derived count,
            grouped by category or publication instead of summed.
          </p>
        </ProseSection>

        <ProseSection id="contribution" heading="How records are added and corrected">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Every record change follows the same path: identify the right file, add or update the
            record, attach public evidence for it, normalize the values (ISO dates, raw view
            counts, never a formatted string), run the data validator, and open a pull request for
            review before it merges and the site rebuilds. Records added from an automated import
            (for example, a press sweep) land at <span className="font-mono">needs_review</span> by
            default and are promoted to verified individually, by hand.
          </p>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            The exact workflow — evidence requirements, id conventions and the full local check
            sequence — is documented in this project&apos;s CONTRIBUTING guide. The project&apos;s
            public repository is not published yet, so the pull-request step described there is
            not currently open outside the maintainer; see{" "}
            <Link href="/about" className="font-bold text-ink underline-offset-2 hover:underline">
              About
            </Link>{" "}
            for the project&apos;s current status.
          </p>
        </ProseSection>

        <ProseSection id="limitations" heading="What this project does not have">
          <ul className="text-body mt-6 max-w-prose space-y-4 text-ink-soft">
            <li>No access to private LayoffHedge analytics of any kind.</li>
            <li>
              No unique-person or unique-device data anywhere in this dataset — every view number
              is a public counter snapshot, never a reach or audience figure.
            </li>
            <li>
              No claim of exhaustive coverage — the archive is manually curated and may not contain
              every public post, repost or article that exists about LayoffHedge.
            </li>
            <li>
              No endorsement claim — a repost, quote post or citation recorded here documents
              amplification, not agreement, and political and media records are described
              factually, never as an endorsement, ranking or validation of any individual or
              publication.
            </li>
          </ul>
        </ProseSection>

        <p className="text-metadata mt-16 text-ink-soft">
          Methodology version {project.methodology_version} · Data last updated{" "}
          {formatDate(project.data_last_updated)}
        </p>
      </main>
      <Footer project={project} />
    </div>
  );
}
