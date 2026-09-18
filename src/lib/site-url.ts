/**
 * docs/ENGINEERING.md §11 — the single env var this project allows
 * (`NEXT_PUBLIC_SITE_URL` "at most"). Single source of truth for the site's
 * absolute canonical URL: `metadataBase` (`src/app/layout.tsx`), `sitemap.ts`
 * and `robots.ts` all read this one constant rather than each hardcoding or
 * re-deriving the URL.
 *
 * Falls back to the canonical Vercel deployment confirmed at the B9 maintainer
 * decision (`docs/WORKPLAN.md`, open question 6) — never an invented domain.
 * A future custom domain (`attentionindex.org`, unregistered as of this date)
 * is a one-variable swap: set `NEXT_PUBLIC_SITE_URL` and nothing here changes.
 *
 * `NEXT_PUBLIC_` because Next.js needs the value in both the server build
 * (sitemap/robots/metadata generation) and, if ever read client-side, the
 * browser bundle — it is a public URL, not a secret, so that prefix is safe.
 */
const CANONICAL_SITE_URL = "https://attention-index-theta.vercel.app";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? CANONICAL_SITE_URL).replace(
  /\/+$/,
  "",
);
