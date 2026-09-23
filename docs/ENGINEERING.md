# ENGINEERING.md

Owns: stack, repo structure, rendering model, layers, styling, routes, error handling, scripts,
testing, CI, deployment.

For the maintenance tools (metric refresh, discovery sweeps, media-mention checks, the visual
review pass), see `docs/TOOLS.md`. For the X, Brave and Serper APIs those tools call, see
`docs/PROVIDERS.md`.

> **Static first. Typed. Validated. Minimal client JavaScript. No backend until needed.**

The site should be technically boring. Complexity belongs in visual composition, editorial
judgement, data quality and source verification — not in infrastructure.

---

## 1. Stack

```text
Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Zod · Vitest · pnpm
motion · lucide-react            (selective)
shadcn/ui · Magic UI             (interaction primitives / selected effects only, always restyled)
```

Forbidden in V1: any database (Postgres, Supabase, Firebase, Mongo, SQLite, Prisma, Drizzle),
any CMS (Sanity, Contentful, Strapi, Directus, Payload), authentication, wallet integration,
large chart libraries, D3, global state libraries, data-fetching libraries, form libraries.

**Dependency gate** — before installing anything: can this be done cleanly in ~100 lines? Does it
materially improve quality? How much client JS does it add? Is it maintained? Will it constrain
the design? If it adds more complexity than value, don't.

Local toolchain note: `pnpm` is not installed on the dev machine; enable it with
`corepack enable pnpm`. If that fails, use `npm` as a fallback.

---

## 2. Rendering model

```text
local JSON → Zod validation → derived metrics → static/server-rendered React → build → CDN
```

Server Components by default. `"use client"` only for: mobile nav state, archive filtering,
hover/tap previews, the one-time count-up, scroll reveals, crossover interaction.
Never make the homepage a client component. No API routes or server actions unless a feature
genuinely requires them. No loading spinners for core content. No runtime fetching of core data.

**Progressive enhancement** — JS may enhance filtering, previews, animation and mobile nav;
it must never gate main metrics, archive rows, source URLs, the disclaimer or methodology links.

---

## 3. Repository structure

```text
/
├── README.md  CONTRIBUTING.md  LICENSE
├── docs/            USING PRODUCT DESIGN HOMEPAGE DATA ENGINEERING EDITORIAL TOOLS PROVIDERS
├── data/            posts.json amplifications.json media.json project.json  schemas/
├── scripts/         validate-data.ts  check-production-data.ts  generate-json-schemas.ts
│                    enrich-twitter-posts.ts  import-layoffhedge-press.ts
│                    check-media-mentions.ts  sweep-quote-tweets.ts  sweep-mentions.ts
│                    sweep-web.ts  review-paid-profiles.ts  refresh-post-metrics.ts
│                    visual-check.mjs
├── src/
│   ├── app/         layout.tsx page.tsx globals.css archive/ evidence/ methodology/ about/
│   ├── components/  flat — hero-statement.tsx, stat-grid.tsx, archive-row.tsx, footer.tsx, …
│   ├── lib/         data/ metrics/ format/ validation/ sweep/  site-url.ts  og-image.tsx
│   └── schemas/     post.schema.ts amplification.schema.ts media.schema.ts project.schema.ts
├── tests/
└── research/       README.md only — the tools' local working data, gitignored, NOT a cache
```

`research/` exists because `.cache/` is disposable by convention and some of what is in there cost
money and cannot be re-obtained — a profile's follower count and bio are readings of a moment, the
same argument `docs/DATA.md §5` makes about view counts. Raw API responses still go to `.cache/`;
what survives a run and was paid for goes to `research/`. See `research/README.md` for what lives
there and why none of it is published.

Avoid deeper nesting than useful.

### Path aliases

```json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"], "@data/*": ["./data/*"] } } }
```

### TypeScript

```json
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true } }
```

Avoid `any`. Prefer types inferred from Zod schemas.

---

## 4. Layers

**`src/schemas/`** — Zod schemas mirroring `docs/DATA.md`. Every canonical file is parsed before use;
failures fail the build loudly.

**`src/lib/data/`** — the only place that imports JSON:
`getPosts, getVerifiedPosts, getAmplifications, getVerifiedAmplifications, getMediaReferences,
getVerifiedMediaReferences, getProjectMetadata`. Validation and filtering live here, not in
components.

**`src/lib/metrics/`** — pure functions: `attention.ts`, `amplification.ts`, `media.ts` exposing
`getAttentionMetrics(posts)`, `getAmplificationMetrics(amps)`, `getMediaMetrics(media)`.
Definitions and eligibility rules are in `docs/DATA.md §10`.

**`src/lib/validation/`** — pure rules a script and a test both need, with no I/O and no JSON
import: `related-post-reference.ts`, `placeholder.ts`, `publication-name.ts`. Scripts import
from here rather than exporting their own helpers, so a test can exercise the rule without
running the script's `main()`.

**`src/lib/sweep/`** — the same arrangement for the discovery tools (`docs/TOOLS.md §12`):
`quote-candidates.ts` holds the judgements `pnpm sweep:quotes` makes about a quote post (is this a
quote of *this* post, is this account already recorded, what is worth a human's attention) as pure
functions with no I/O. Nothing the site renders imports it. It lives here for the reason
`validation/` does — the decisions that shape what a maintainer is asked to read are testable
without spending an API budget to exercise them.

**`src/lib/format/`** — `number.ts`, `date.ts`, `country.ts` (ISO-2 to a display name, falling
back to the code), `cited-work.ts` (the `cited_work` enum, `docs/DATA.md §7`, as the reader's
words, with `none` deliberately unlabelled — a reference that names no work is described by the
sentence counting it), `media-descriptors.ts` (the media record attributes as words, shared by the
Public References panel and the `/evidence` media rows):

```ts
formatCompactNumber(18_700_000) // "18.7M"   max one decimal
formatCount(42)                 // "42"
formatDate("2026-09-15")        // "SEP 15 2026"
```

No formatting logic duplicated in components. Components never contain production data literals:

```tsx
<Stat value="42" label="Posts above 1M" />               // bad
<Stat value={metrics.postsOver1M} label="Posts above 1M" /> // good
```

---

## 5. Styling

Tailwind for layout and composition; CSS variables for design tokens defined once in
`src/app/globals.css` (or a token file imported globally): colors, radii, motion durations,
spacing primitives where useful. Token values live in `docs/DESIGN.md §3`.
Never scatter brand hex codes. If a color changes after visual review, change the token.

Fonts via `next/font` — Manrope + IBM Plex Mono, only the weights used, self-hosted (no runtime
external font requests).

---

## 6. Routes

```text
/             homepage
/archive      all verified posts, client-side filtering (dataset is small; no search backend)
/evidence     browsable list of posts / amplifications / media — a simple table is enough
/methodology  statically authored prose (not generated from code)
/about        purpose, independence, open source, official links, GitHub
```

Methodology must explain: source definitions, observation dates, view-count limitations,
verification meaning, derived metric definitions, double-counting caveat, contribution model,
and what data is unavailable. Minimum required statements:

```text
Observed views are public post-counter snapshots.
They are not unique-user counts.
The project does not have access to private LayoffHedge analytics.
Inclusion in the archive documents public reach; it does not verify every claim inside a post.
```

Anchors are native; smooth scrolling optional and reduced-motion aware.

Sitemap covers the five routes; robots indexes public routes only (`src/app/sitemap.ts`,
`src/app/robots.ts`). Both read `SITE_URL` (`src/lib/site-url.ts`), the single source of truth for
that URL — `NEXT_PUBLIC_SITE_URL` if set, else the canonical Vercel deployment. Each route carries
its own `metadata` (title, description, OG/Twitter text fields). Every route that declares its own
`openGraph`/`twitter` object also repeats an explicit `images` pointer at the root
`opengraph-image.tsx` / `twitter-image.tsx` route, rather than relying on inheritance: Next only
auto-applies a file-convention image to a segment that declares no `images` key of its own, and
that check does not cascade past a child segment that redeclares the object. Omitting this leaves
`/archive`, `/evidence`, `/methodology` and `/about` with no `og:image`/`twitter:image` at all
while `/` keeps the root's — verified in the built HTML.

---

## 7. Error handling, empty states, safety

Validation errors fail loudly at build/dev time. Pages must not crash on a `null` optional field —
components handle missing `portrait, logo, likes, reposts, author, country, screenshot`.

Empty categories hide or show a restrained `No verified records yet.` — never zeros for decoration,
never fake placeholder content in production. Section visibility rules: `docs/HOMEPAGE.md §2`.

Security: all JSON text renders as plain React text; no `dangerouslySetInnerHTML`; no Markdown/HTML
interpretation from data files; `rel="noopener noreferrer"` on `target="_blank"`; no secrets in
client code. A strict CSP can be added once the visual layer stabilizes (easy, since there are no
external embeds).

**No live X embeds** as a core dependency. Use `text metadata + optional local screenshot + VIEW ORIGINAL ↗`.

---

## 8. Scripts

`package.json`'s `scripts` object is the source of truth for every command's exact invocation.
This table says what each one is for and where it is documented — not the command itself, so it
cannot drift out of sync the way a copy of the JSON block used to.

| Command | Purpose | Documented in |
|---|---|---|
| `dev` | local development server | — |
| `build` | production build | — |
| `start` | serve a production build | — |
| `lint` | ESLint | — |
| `typecheck` | `tsc --noEmit` | — |
| `test` | Vitest | this doc, §9 |
| `validate:data` | Zod-validate every file in `data/` | `docs/DATA.md` |
| `check:production-data` | production gate — rejects visible placeholders and metrics derived from anything but verified records | `docs/DATA.md §12` |
| `generate:schemas` | regenerate `data/schemas/*.schema.json` from the Zod schemas | `docs/DATA.md §1, §12` |
| `refresh:metrics` | buy a new reading of tracked posts' public counters | `docs/TOOLS.md §3` |
| `enrich:twitter` | fill post/amplification metadata from tweet text | `docs/TOOLS.md §4` |
| `import:press` | seed `data/media.json` from the official press page | `docs/TOOLS.md §5` |
| `check:media-mentions` | check whether a page names this project | `docs/TOOLS.md §6` |
| `sweep:mentions` | Track A — full-archive text search | `docs/TOOLS.md §7` |
| `sweep:quotes` | Track B — enumerate quote posts | `docs/TOOLS.md §8` |
| `review:profiles` | re-read already-paid-for profiles | `docs/TOOLS.md §9` |
| `sweep:web` | web-search discovery sweep | `docs/TOOLS.md §10` |
| `check:visual` | browser review pass at three widths | `docs/TOOLS.md §11` |

None of the maintenance tools (`refresh:metrics` through `check:visual`) is part of the pre-deploy
pipeline below: `check:visual` must not run alongside a build, and the rest make outbound requests
to third-party services.

Pre-deploy pipeline:

```bash
pnpm validate:data && pnpm check:production-data && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

---

## 9. Testing

Vitest. Pragmatic minimum:

- **metrics** — threshold boundaries `999_999 / 1_000_000 / 4_999_999 / 5_000_000 / 9_999_999 /
  10_000_000`; archived, `needs_review` and placeholder records excluded; empty dataset; tie for top post
- **schemas** — duplicate IDs rejected · dangling `related_post_id` rejected · malformed date rejected ·
  malformed URL rejected · verified amplification without evidence rejected · negative views rejected
- **production check** — placeholder detection works
- basic route smoke tests

Metric functions must be deterministic. Do not spend time testing presentational markup.
Playwright is optional and later.

### A test over the live `data/` files asserts relationships, not values

A test that pins a headline figure as a literal against `data/` is a good guard for a hand-made
edit — it forces a human to confirm the number moved on purpose — and a bad one for a dataset that
grows by import or sweep, because the suite goes red on the first new record and a job that edits
its own expectations to go green is not a guard at all.

So the two jobs are split, and neither assertion is deleted:

```text
tests/data-integration.test.ts   live data/ — every expectation recomputed from the JSON on disk,
                                 read independently of src/lib, plus cross-metric invariants
tests/frozen-dataset.test.ts     tests/fixtures/dataset-2026-09-20/ — the literal figures
                                 (32 posts · 43,625,943 views · 10 amplifications · 94 references)
                                 against input that cannot drift
```

The frozen fixture guards the **derivation chain** — schema parse, eligibility rule, pure metric,
formatted figure — not the dataset. It is re-cut only when a schema migration makes it unparseable,
and the figures are then re-derived and read by a human, never pasted from the run that failed. A
required `cited_work` field added to every media record is one such migration so far: the
fixture's own copies needed it before they would parse again.

**Every live-data test is now in this shape.** `tests/evidence.test.ts`, `tests/media-contract.test.ts`,
`tests/public-references.test.ts`, `tests/attention-grid.test.ts`, `tests/archive.test.ts` and
`tests/observations.test.ts` all recompute their expectations from `data/` on disk; their literal
figures live in the frozen fixture instead, and one of them is now a stronger live check than a
pinned literal would be: every frozen reading must still head its post's history, which is the
append-only rule tested against the file. If a new test reads `data/`, write it this way from the
start, and probe it (change the data, run the suite, restore) rather than trusting this paragraph.

---

## 10. CI

GitHub Actions on `pull_request` and `push: main`:

```text
install → validate:data → check:production-data → typecheck → lint → test → build
```

A PR with invalid production data must fail. No git hooks in V1 — CI is enough.

`.github/workflows/ci.yml`, one `verify` job on `ubuntu-latest` with pinned actions. pnpm comes
from the `packageManager` field in `package.json`, so the version is declared once.

---

## 11. Deployment

Vercel, connected to `https://github.com/0xFlimbo/attention-index` through its GitHub integration.
Production is `main`; the canonical URL is `https://attention-index-theta.vercel.app` (Vercel
appended the suffix because the plain subdomain was taken). Stay portable — do not design around
the provider. Cloudflare remains a later option.

A custom domain is a one-variable change, deliberately not a prerequisite: set
`NEXT_PUBLIC_SITE_URL` and add a redirect. `src/lib/site-url.ts` is the single source of truth that
`metadataBase`, `sitemap.ts` and `robots.ts` all read; nothing else hardcodes the URL.

**A push does not mean a deploy.** GitHub Actions starts within seconds of a push, and Vercel can
lag behind it by several minutes. Vercel registers a deployment on GitHub only once the build
actually starts, so during that window the GitHub API reports nothing rather than "queued", and
absence there is not evidence of a lost webhook. The Vercel dashboard is the only reliable source
in that window. Verify the live site after a push instead of assuming it followed.

Preview review checklist: 1440 / 768 / 390, motion, source links, no placeholder production data.

Env vars: `NEXT_PUBLIC_SITE_URL` only, and optional — it overrides the fallback in
`src/lib/site-url.ts`. Public content belongs in `project.json`, never in env vars. Analytics
optional, privacy-respecting, never blocking.

Browser support: current Chrome, Edge, Firefox, Safari, Mobile Safari, Chrome Android.

---

## 12. Future backend trigger

Introduce a backend only for: authenticated contributor workflow, high-frequency automated
ingestion, a dataset needing indexed search, official first-party analytics integration, moderation
that GitHub cannot handle, or server-side secrets. Until then, stay static — and keep the frontend
data contract stable so future ingestion writes the same records.

---

## 13. Technical acceptance checklist

- [ ] App Router · strict TypeScript · static core content · no backend
- [ ] JSON schema-validated; duplicate IDs, broken references and placeholders rejected
- [ ] Headline metrics derived
- [ ] Mobile intentionally implemented; reduced motion supported
- [ ] Source links work; no live social embed required
- [ ] No unnecessary client-side data fetching
- [ ] typecheck, lint, tests, data validation and build all pass
- [ ] Preview deployment visually reviewed at 390 / 768 / 1440
