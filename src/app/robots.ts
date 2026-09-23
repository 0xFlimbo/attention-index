import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * docs/ENGINEERING.md §6 — "robots indexes public routes only." Every route
 * this site ships is already public (no auth, no draft/admin surface), so
 * "public routes only" means allow everything rather than an allow-list of
 * paths. Points at `sitemap.ts`, built in the same batch for the same reason
 * (needs `SITE_URL`, which did not exist until the deployment target was confirmed).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
