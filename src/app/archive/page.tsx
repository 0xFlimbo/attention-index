import type { Metadata } from "next";
import { getPosts, getProjectMetadata } from "@/lib/data";
import { selectArchivePosts, selectArchiveThresholds } from "@/lib/metrics/archive";
import { toArchiveRowData } from "@/components/archive-row";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ArchiveExplorer } from "@/components/archive-explorer";

/** docs/ENGINEERING.md §6 — route metadata, same title style as the B2 placeholder it replaces. */
export const metadata: Metadata = {
  title: "Viral Archive — LayoffHedge Attention Index",
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
