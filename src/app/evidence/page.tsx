import type { Metadata } from "next";
import { getProjectMetadata } from "@/lib/data";
import { Navigation } from "@/components/navigation";

/**
 * B2 scope: honest placeholder only — the real Evidence / Sources route
 * ships in B5 (docs/WORKPLAN.md). No design time spent beyond inheriting
 * the base look, per this batch's briefing.
 */
export const metadata: Metadata = {
  title: "Sources — LayoffHedge Attention Index",
};

export default function EvidencePage() {
  const project = getProjectMetadata();

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Evidence &amp; Sources</h1>
        <p className="text-body mt-6 max-w-prose text-ink-soft">
          This page is not built yet.
        </p>
        <p className="text-body mt-4 max-w-prose text-ink-soft">
          It will list this project&apos;s derived dataset counts — tracked posts, verified
          amplifications, media references, milestones — each linking to the underlying
          records and raw source data.
        </p>
        <p className="text-metadata mt-12 text-ink-soft">{project.disclaimer}</p>
      </main>
    </div>
  );
}
