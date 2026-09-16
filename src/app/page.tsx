import { getPosts, getAmplifications, getMediaReferences, getProjectMetadata } from "@/lib/data";
import { getAttentionMetrics } from "@/lib/metrics/attention";
import { getAmplificationMetrics } from "@/lib/metrics/amplification";
import { getMediaMetrics } from "@/lib/metrics/media";
import { formatCompactNumber, formatCount } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";

/**
 * TEMPORARY B1 PLACEHOLDER — this is a data-layer smoke test, not a design.
 * It exists to prove the schemas, loaders, metrics and formatters work end to
 * end before B2 builds the real homepage composition. Do not treat this
 * markup as a starting point for the visual system in docs/DESIGN.md.
 */
export default function Home() {
  const project = getProjectMetadata();
  const attention = getAttentionMetrics(getPosts());
  const amplification = getAmplificationMetrics(getAmplifications());
  const media = getMediaMetrics(getMediaReferences());

  return (
    <main style={{ fontFamily: "monospace", padding: 32, whiteSpace: "pre-wrap" }}>
      <h1>{project.project_name} — B1 data-layer smoke test</h1>
      <p>{project.disclaimer}</p>

      <h2>Attention</h2>
      <ul>
        <li>trackedPostCount: {formatCount(attention.trackedPostCount)}</li>
        <li>postsOver1M: {formatCount(attention.postsOver1M)}</li>
        <li>postsOver5M: {formatCount(attention.postsOver5M)}</li>
        <li>postsOver10M: {formatCount(attention.postsOver10M)}</li>
        <li>totalObservedViews: {formatCount(attention.totalObservedViews)} ({formatCompactNumber(attention.totalObservedViews)})</li>
        <li>
          topPost: {attention.topPost === null
            ? "none"
            : `${formatCompactNumber(attention.topPost.views)} views, observed ${formatDate(attention.topPost.observedAt)} — ${attention.topPost.url}`}
        </li>
      </ul>

      <h2>Amplification</h2>
      <ul>
        <li>verifiedAmplificationCount: {formatCount(amplification.verifiedAmplificationCount)}</li>
        <li>uniqueAmplifierCount: {formatCount(amplification.uniqueAmplifierCount)}</li>
        <li>
          countsByCategory: {Object.entries(amplification.countsByCategory)
            .map(([category, count]) => `${category}=${count}`)
            .join(", ")}
        </li>
      </ul>

      <h2>Media</h2>
      <ul>
        <li>verifiedMediaReferenceCount: {formatCount(media.verifiedMediaReferenceCount)}</li>
        <li>uniquePublicationCount: {formatCount(media.uniquePublicationCount)}</li>
      </ul>

      <p>Data last updated: {formatDate(project.data_last_updated)}</p>
    </main>
  );
}
