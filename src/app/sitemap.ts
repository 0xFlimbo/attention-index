import type { MetadataRoute } from "next";
import { getAmplifications, getMediaReferences, getPosts } from "@/lib/data";
import { dataLastUpdated } from "@/lib/metrics/last-updated";
import { SITE_URL } from "@/lib/site-url";

/**
 * docs/ENGINEERING.md §6 — "Sitemap covers the five routes." Deferred until
 * it needs an absolute canonical URL (`SITE_URL`), which did not
 * exist until the Vercel deployment target was confirmed. No invented routes:
 * exactly the five real ones this site ships (`docs/ENGINEERING.md §6`'s own
 * route table) — no `/methodology#anchor`-style entries, no route that
 * doesn't exist.
 *
 * `lastModified` uses `dataLastUpdated` (src/lib/metrics/last-updated.ts) for
 * every route: it is the one dated fact this project keeps about "when the
 * content changed", derived from the dataset rather than a hand-typed project
 * field, and every route's content (headline metrics, archive, evidence, even
 * the static prose pages, which quote live-derived numbers in `/methodology`)
 * depends on the dataset that date describes. `lastModified` is omitted
 * entirely for every route when the dataset holds no eligible record to date.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastUpdated = dataLastUpdated(getPosts(), getAmplifications(), getMediaReferences());
  const lastModified = lastUpdated === null ? undefined : new Date(lastUpdated);

  const routes: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/archive", priority: 0.8 },
    { path: "/evidence", priority: 0.8 },
    { path: "/methodology", priority: 0.5 },
    { path: "/about", priority: 0.5 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified !== undefined && { lastModified }),
    changeFrequency: "weekly",
    priority,
  }));
}
