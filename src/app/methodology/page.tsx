import type { Metadata } from "next";
import { ogImageDescriptor, twitterImageDescriptor } from "@/lib/og-image-meta";
import Link from "next/link";
import { getPosts, getAmplifications, getMediaReferences, getProjectMetadata } from "@/lib/data";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { getAmplificationMetrics } from "@/lib/metrics/amplification";
import { getMediaMetrics } from "@/lib/metrics/media";
import { dataLastUpdated } from "@/lib/metrics/last-updated";
import { formatCount } from "@/lib/format/number";
import { formatCitedWork } from "@/lib/format/cited-work";
import { mediaCitedWorkEnum } from "@/schemas/media.schema";
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
  // docs/DATA.md §9, §10 — derived, not a hand-typed project field. `null`
  // only when the dataset holds no verified record anywhere.
  const lastUpdated = dataLastUpdated(posts, amplifications, mediaReferences);

  // Records held at `needs_review` are real rows in the dataset, just not yet
  // public — stating how many exist is honest, not a fabricated number, and
  // it is derived the same way `isVerifiedRecord` is (never `.length` alone).
  const mediaNeedsReviewCount = mediaReferences.filter(
    (reference) => reference.status === "needs_review" && reference._placeholder !== true,
  ).length;

  // docs/WORKPLAN.md B16 — the named works, in schema order, each with its own
  // live count. Built from the enum rather than written out, so adding a work
  // to the schema puts it in this sentence instead of leaving the page a
  // member short. `none` has no label and is written by hand below, because
  // "names no work" is a clause, not the name of a thing.
  const citedWorkClauses = mediaCitedWorkEnum.options
    .map((work) => ({ label: formatCitedWork(work), count: mediaMetrics.originalReferencesByCitedWork[work] }))
    .filter((entry): entry is { label: string; count: number } => entry.label !== null)
    .map((entry) => `${formatCount(entry.count)} cite ${entry.label}`);

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
            The dataset behind this site is three record types, each in its own file:
          </p>
          <ul className="text-body mt-6 max-w-prose space-y-4 text-ink-soft">
            <li>
              <strong className="text-ink">Tracked posts</strong> — public posts published by
              @LayoffAI, each paired with dated readings of its public view counter.
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
            View counts on this site are readings of the public view counter each X post displays,
            taken at a specific point in time. Early readings were copied by hand from the post
            itself, where X rounds large numbers. Later ones come from X&apos;s developer API, which
            returns the same counter unrounded. Neither is a private analytics figure.
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
            a development placeholder, feed any number shown on this website.{" "}
            {lastUpdated !== null && <>As of {formatDateLong(lastUpdated)}, </>}
            {formatCount(mediaMetrics.verifiedMediaReferenceCount)}{" "}
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

        {/*
          docs/WORKPLAN.md B13 — the media record contract stated in the
          reader's words: what provenance changes about the counts, and the
          written criterion behind the `featured` flag. Every figure here is
          read live from `getMediaMetrics`, like the rest of this page.
        */}
        <ProseSection id="media-contract" heading="Featured references, and how republications count">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Some of the coverage in this dataset is a publication&apos;s own reporting. Some of it
            is one outlet republishing another outlet&apos;s piece, which wire services,
            aggregators and partner sites do routinely. Every verified media record says which of
            the two it is, and a republication names the outlet it credits. Of the{" "}
            {formatCount(mediaMetrics.verifiedMediaReferenceCount)} verified references today,{" "}
            {formatCount(mediaMetrics.originalReferenceCount)} are the publication&apos;s own work
            and {formatCount(mediaMetrics.syndicatedReferenceCount)}{" "}
            {mediaMetrics.syndicatedReferenceCount === 1 ? "is a republication" : "are republications"}{" "}
            of a piece recorded elsewhere.
          </p>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            That distinction changes what a number means, so two figures are kept apart rather
            than merged. A count of <strong className="text-ink">records</strong> — the media
            figure in the dataset summary and on the evidence page — includes republications,
            because each one is a real page a real outlet published and a reader can open it. A
            count of <strong className="text-ink">reporting</strong> counts originals only,
            because a republication is the same piece travelling, not a second newsroom reading
            the data. One outlet&apos;s article and eight republications of it are one piece of
            reporting, and any figure that added them together would overstate the coverage by
            eight.
          </p>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Each record also carries the country of the publication&apos;s own newsroom — not the
            country the story is about. Counted across original references only, the verified
            records come from newsrooms in {formatCount(mediaMetrics.countryCount)}
            {/* Bound to its noun, same reason as the homepage sentence that prints this figure. */}
            {"\u00A0"}
            {mediaMetrics.countryCount === 1 ? "country" : "countries"}. Where a publication&apos;s
            newsroom country is not settled by a public, citable statement, the field is left
            blank and that record is counted in no country at all — a blank is not a guess, and it
            is never quietly filled with the likeliest answer.
          </p>
          <p className="text-body mt-8 max-w-prose text-ink-soft">
            <strong className="text-ink">Featured references.</strong> A reference is marked
            featured when two things are true of it: the publication produced the piece itself
            rather than republishing someone else&apos;s, and the piece names LayoffHedge or
            @LayoffAI in its own text — or, for a broadcast, on air — as the source of data or
            findings it reports, rather than only embedding or linking a post alongside its own
            reporting. Today{" "}
            {formatCount(mediaMetrics.featuredReferenceCount)} of the{" "}
            {formatCount(mediaMetrics.verifiedMediaReferenceCount)} verified references meet it.
          </p>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            This is curation, and it is declared as curation rather than dressed up as a
            measurement. It is a rule this project wrote, applied by hand, and it is binary — a
            reference meets it or it does not. There is no score, no tier and no ranking of
            publications anywhere in this dataset. All the flag does is position: a featured
            reference&apos;s publication sorts above others that carry the same number of
            references. There is no star, badge or icon marking it, and a reference that is not
            featured is not a weaker source or a lesser publication — it means the record does not
            show the article naming the project as a source in its own words. A reference can only
            be featured once it has been verified.
          </p>
        </ProseSection>

        <ProseSection id="cited-work" heading="Which work a reference cites">
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            A publication that references LayoffHedge is doing one of two things. It is using
            something LayoffHedge published — the layoff data, the H-1B filings data, an
            investigation — or it is embedding or quoting an @LayoffAI post and reporting what the
            post says. Those are different acts, and every verified media record says which one it
            is. The answer is stored as one of a fixed set of values rather than as free text, so
            it can be counted rather than read.
          </p>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            A record names a work only when the record&apos;s own evidence shows the piece using
            it: the article names or links a dataset, or one of the surfaces built on it, or it
            names an investigation. Where the evidence shows an embedded post, a quotation, or
            LayoffHedge named as a source and nothing further, the record says that no work was
            named. That is a determination, not a blank — it is the conservative default, the same
            way a reference that is not featured is not thereby a weaker source.
          </p>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Counted across the {formatCount(mediaMetrics.originalReferenceCount)} original
            references — a republication carries the answer of the piece it copies, so counting it
            too would report one newsroom&apos;s use of a dataset as two —{" "}
            {citedWorkClauses.join(", ")}, and{" "}
            {formatCount(mediaMetrics.originalReferencesByCitedWork.none)} name no work beyond the
            post or the account itself.
          </p>
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            Nothing here describes or rates what LayoffHedge makes. The value is an attribute of a
            reference that already exists, and the list holds only the works these records give
            evidence of — something LayoffHedge publishes that no verified reference has cited does
            not appear on it at all, and neither does any judgement about which work matters. The
            list is closed on purpose: adding to it is a change to the schema and to this page,
            made when a record shows a work that has none, never a phrase typed into a record.
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
          {/*
            Repository-aware, not asserted. This paragraph shipped at B6 saying
            the repository "is not published yet", which stopped being true on
            2026-09-18 and was still on the page at B13 — a hardcoded fact about
            a field that already exists. It now reads from
            `project.repository_url`, the same switch the navigation, the footer
            and the Evidence panel use (docs/DATA.md §9: a `null`
            `repository_url` must degrade gracefully), so the sentence cannot go
            stale again in either direction. No link is added here: the
            `CONTRIBUTE DATA ↗` / `SUBMIT A CORRECTION ↗` CTAs live on
            `/evidence` by the 2026-09-18 maintainer decision, and this points
            at them rather than duplicating them.
          */}
          <p className="text-body mt-6 max-w-prose text-ink-soft">
            The exact workflow — evidence requirements, id conventions and the full local check
            sequence — is documented in this project&apos;s CONTRIBUTING guide.{" "}
            {project.repository_url !== null ? (
              <>
                It lives in the public repository, and a correction or a new record is submitted
                there; the links are on{" "}
                <Link
                  href="/evidence#contribute"
                  className="font-bold text-ink underline-offset-2 hover:underline"
                >
                  Evidence &amp; Sources
                </Link>
                .
              </>
            ) : (
              <>
                The project&apos;s public repository is not published yet, so the pull-request step
                described there is not currently open outside the maintainer.
              </>
            )}{" "}
            See{" "}
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
          Methodology version {project.methodology_version}
          {lastUpdated !== null && <> · Data last updated {formatDate(lastUpdated)}</>}
        </p>
      </main>
      <Footer project={project} />
    </div>
  );
}
