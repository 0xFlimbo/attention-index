import type { Metadata } from "next";
import { getProjectMetadata } from "@/lib/data";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";

/**
 * B2 scope: honest placeholder only — the real Methodology route ships in
 * B6 (docs/WORKPLAN.md). No design time spent beyond inheriting the base
 * look, per this batch's briefing. B5 adds only the `Footer`; nothing else
 * on this page changes.
 */
export const metadata: Metadata = {
  title: "Methodology — LayoffHedge Attention Index",
};

export default function MethodologyPage() {
  const project = getProjectMetadata();

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Methodology</h1>
        <p className="text-body mt-6 max-w-prose text-ink-soft">
          This page is not built yet.
        </p>
        <p className="text-body mt-4 max-w-prose text-ink-soft">
          It will state exactly how views are observed and recorded, how records move from
          `needs_review` to `verified`, the exact metric thresholds used across the site, and
          this project&apos;s known limitations.
        </p>
        <p className="text-metadata mt-12 text-ink-soft">{project.disclaimer}</p>
      </main>
      <Footer project={project} />
    </div>
  );
}
