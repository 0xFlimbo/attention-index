import { getPosts, getAmplifications, getMediaReferences, getProjectMetadata } from "@/lib/data";
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
import { PublicReferences } from "@/components/public-references";
import { EvidenceBlock } from "@/components/evidence-block";
import { Footer } from "@/components/footer";

/**
 * docs/HOMEPAGE.md §1 — sections 00–04 (B2), Crossover + Amplified By
 * (05–06, B4), Viral Archive (07, B3), Public References (08, B8),
 * Evidence + Footer (09, 11, B5). Thin composition: data loading + metrics
 * calls, no layout logic, no inline metric math.
 */
export default function Home() {
  const project = getProjectMetadata();
  const posts = getPosts();
  const amplifications = getAmplifications();
  const mediaReferences = getMediaReferences();
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
          repositoryUrl={project.repository_url}
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
        <PublicReferences mediaReferences={mediaReferences} />
        <EvidenceBlock
          posts={posts}
          amplifications={amplifications}
          mediaReferences={mediaReferences}
          repositoryUrl={project.repository_url}
        />
      </main>
      <Footer project={project} />
    </div>
  );
}
