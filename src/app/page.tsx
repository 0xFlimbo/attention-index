import { getPosts, getAmplifications, getProjectMetadata } from "@/lib/data";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { selectAttentionGridCells } from "@/lib/metrics/attention-grid";
import { Navigation } from "@/components/navigation";
import { HeroStatement } from "@/components/hero-statement";
import { PrimaryAttentionMetric } from "@/components/primary-attention-metric";
import { StatGrid } from "@/components/stat-grid";
import { NarrativeBreak } from "@/components/narrative-break";
import { CrossoverMap } from "@/components/crossover-map";
import { AmplifiedBy } from "@/components/amplified-by";
import { ViralArchive } from "@/components/viral-archive";

/**
 * docs/HOMEPAGE.md §1 — sections 00–04 (B2), Crossover + Amplified By
 * (05–06, B4), Viral Archive (07, B3). Thin composition: data loading +
 * metrics calls, no layout logic, no inline metric math. Sections 08, 09, 11
 * (Public References, Evidence, Footer) ship in later batches.
 */
export default function Home() {
  const project = getProjectMetadata();
  const posts = getPosts();
  const amplifications = getAmplifications();
  const attention = getAttentionMetrics(posts);
  const gridCells = selectAttentionGridCells(attention);

  return (
    <div id="top">
      <Navigation repositoryUrl={project.repository_url} />
      <main>
        <HeroStatement disclaimer={project.disclaimer} />
        <PrimaryAttentionMetric
          totalObservedViews={attention.totalObservedViews}
          trackedPostCount={attention.trackedPostCount}
          lastUpdated={project.data_last_updated}
          sourceDataHref="/evidence"
          methodologyHref="/methodology"
        />
        <StatGrid cells={gridCells} />
        <NarrativeBreak />
        <CrossoverMap amplifications={amplifications} />
        <AmplifiedBy
          amplifications={amplifications}
          posts={posts}
          officialXAccount={project.official_x_account}
        />
        <ViralArchive posts={posts} />
      </main>
    </div>
  );
}
