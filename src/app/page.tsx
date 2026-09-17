import { getPosts, getProjectMetadata } from "@/lib/data";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { selectAttentionGridCells } from "@/lib/metrics/attention-grid";
import { Navigation } from "@/components/navigation";
import { HeroStatement } from "@/components/hero-statement";
import { PrimaryAttentionMetric } from "@/components/primary-attention-metric";
import { StatGrid } from "@/components/stat-grid";
import { NarrativeBreak } from "@/components/narrative-break";

/**
 * docs/HOMEPAGE.md §1 — sections 00–04 only (B2 scope). Thin composition:
 * data loading + metrics calls, no layout logic, no inline metric math.
 * Sections 05+ (Crossover, Amplified By, Viral Archive, Public References,
 * Evidence, Footer) ship in later batches.
 */
export default function Home() {
  const project = getProjectMetadata();
  const attention = getAttentionMetrics(getPosts());
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
      </main>
    </div>
  );
}
