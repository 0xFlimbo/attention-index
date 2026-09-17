import type { Metadata } from "next";
import { getProjectMetadata } from "@/lib/data";
import { Navigation } from "@/components/navigation";

/**
 * B2 scope: honest placeholder only — the real Viral Archive route ships in
 * B3 (docs/WORKPLAN.md). No design time spent beyond inheriting the base
 * look, per this batch's briefing.
 */
export const metadata: Metadata = {
  title: "Viral Archive — LayoffHedge Attention Index",
};

export default function ArchivePage() {
  const project = getProjectMetadata();

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Viral Archive</h1>
        <p className="text-body mt-6 max-w-prose text-ink-soft">
          This page is not built yet.
        </p>
        <p className="text-body mt-4 max-w-prose text-ink-soft">
          It will list every publicly verified LayoffHedge / @LayoffAI post tracked by this
          project, sorted by observed views, with client-side threshold filters and a visible
          source link for every row.
        </p>
        <p className="text-metadata mt-12 text-ink-soft">{project.disclaimer}</p>
      </main>
    </div>
  );
}
