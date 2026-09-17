import type { Metadata } from "next";
import { getProjectMetadata } from "@/lib/data";
import { Navigation } from "@/components/navigation";

/**
 * B2 scope: honest placeholder only — the real About route ships in B6
 * (docs/WORKPLAN.md). No design time spent beyond inheriting the base
 * look, per this batch's briefing.
 */
export const metadata: Metadata = {
  title: "About — LayoffHedge Attention Index",
};

export default function AboutPage() {
  const project = getProjectMetadata();

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl font-bold tracking-tight text-ink">About</h1>
        <p className="text-body mt-6 max-w-prose text-ink-soft">
          This page is not built yet.
        </p>
        <p className="text-body mt-4 max-w-prose text-ink-soft">
          It will explain who built this project, why it exists, and how to contribute a
          correction or a new verified record.
        </p>
        <p className="text-metadata mt-12 text-ink-soft">{project.disclaimer}</p>
      </main>
    </div>
  );
}
