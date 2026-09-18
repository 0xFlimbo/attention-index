import type { Metadata } from "next";
import { ogImageDescriptor, twitterImageDescriptor } from "@/lib/og-image-meta";
import { getPosts, getProjectMetadata } from "@/lib/data";
import { selectArchivePosts, selectArchiveThresholds } from "@/lib/metrics/archive";
import { toArchiveRowData } from "@/components/archive-row";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ArchiveExplorer } from "@/components/archive-explorer";

/**
 * docs/ENGINEERING.md §6, docs/WORKPLAN.md B6 — route metadata. `title` is
 * short: `src/app/layout.tsx`'s `template` appends " — LayoffHedge Attention
 * Index", reproducing the exact string this route shipped before B6. OG/
 * Twitter carry their own full-string title (templates don't apply there).
 *
 * `images` is explicit here (B9), not left to inherit from the root
 * `opengraph-image.tsx` / `twitter-image.tsx` file convention: Next only
 * auto-applies a file-convention image to a segment's `openGraph`/`twitter`
 * metadata when that exact segment declares no `images` key of its own — and
 * critically, that check is per segment, not inherited down the tree. This
 * route declares its own `openGraph`/`twitter` objects (for its title/
 * description), which replaces the root's already-resolved image rather than
 * extending it. Verified in the built HTML: without this, `/archive`,
 * `/evidence`, `/methodology` and `/about` rendered no `og:image`/
 * `twitter:image` at all, while `/` (which sets no page-level `openGraph`)
 * kept the root's. Pointing at the route path directly (resolved against
 * `metadataBase`) is equivalent to the framework's own generated URL, just
 * without its cache-busting query hash.
 */
const TITLE = "Viral Archive";
const DESCRIPTION =
  "Every publicly verified LayoffHedge / @LayoffAI post this project tracks, ranked by observed views, with a link back to the original public post.";

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
 * docs/HOMEPAGE.md §10, docs/ENGINEERING.md §6 — every verified post, ranked
 * and sorted once here on the server (`selectArchivePosts`), with
 * client-side threshold filtering and a desktop hover/focus preview layered
 * on top by `ArchiveExplorer`. Thin composition: data + metrics calls only,
 * no layout logic — matching how B2 left `src/app/page.tsx`.
 */
export default function ArchivePage() {
  const project = getProjectMetadata();
  const posts = getPosts();
  const rows = selectArchivePosts(posts).map(({ post, rank }) => toArchiveRowData(post, rank));
  const thresholds = selectArchiveThresholds(posts);

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">Viral Archive</h1>
        <p className="text-body mt-6 max-w-prose text-ink-soft">
          Every publicly verified LayoffHedge / @LayoffAI post this project tracks, sorted by
          observed views. Each row links to the original public post.
        </p>
        <p className="text-metadata mt-6 text-ink-soft">{project.disclaimer}</p>

        <div className="mt-12">
          <ArchiveExplorer rows={rows} thresholds={thresholds} />
        </div>
      </main>
      <Footer project={project} />
    </div>
  );
}
