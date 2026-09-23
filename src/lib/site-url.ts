/**
 * docs/ENGINEERING.md §11 — the single env var this project allows
 * (`NEXT_PUBLIC_SITE_URL` "at most"). Single source of truth for the site's
 * absolute canonical URL: `metadataBase` (`src/app/layout.tsx`), `sitemap.ts`
 * and `robots.ts` all read this one constant rather than each hardcoding or
 * re-deriving the URL.
 *
 * Falls back to the canonical domain, `attentionindex.org`, so a build without
 * the variable (a fork's preview, CI) still names the real site rather than a
 * deployment host. Production sets `NEXT_PUBLIC_SITE_URL` to the same value.
 *
 * `NEXT_PUBLIC_` because Next.js needs the value in both the server build
 * (sitemap/robots/metadata generation) and, if ever read client-side, the
 * browser bundle — it is a public URL, not a secret, so that prefix is safe.
 */
const CANONICAL_SITE_URL = "https://attentionindex.org";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? CANONICAL_SITE_URL).replace(
  /\/+$/,
  "",
);
