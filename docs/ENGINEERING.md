# ENGINEERING.md

Owns: stack, repo structure, rendering, scripts, testing, CI, deployment, data-maintenance tools.
(Consolidated from `TECHNICAL_SPEC.md`, kept in `docs/archive/`.)

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
`corepack enable pnpm`. If that fails, use `npm` and record the deviation in `docs/WORKPLAN.md`.

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
├── CLAUDE.md  AGENTS.md  README.md
├── docs/            PRODUCT DESIGN HOMEPAGE DATA ENGINEERING EDITORIAL WORKPLAN + archive/
├── data/            posts.json amplifications.json media.json milestones.json project.json
├── public/
│   ├── images/      posts/ people/ media/
│   └── og/
├── scripts/         validate-data.ts  check-production-data.ts
│                    enrich-twitter-posts.ts  import-layoffhedge-press.ts
├── src/
│   ├── app/         layout.tsx page.tsx archive/ evidence/ methodology/ about/
│   ├── components/  layout/ editorial/ data/ archive/ ui/
│   ├── lib/         data/ metrics/ format/ utils/
│   ├── schemas/     post.schema.ts amplification.schema.ts media.schema.ts
│   │                milestone.schema.ts project.schema.ts
│   ├── styles/
│   └── types/
├── tests/
└── references/visual/   (design references, not shipped)
```

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
getMilestones, getProjectMetadata`. Validation and filtering live here, not in components.

**`src/lib/metrics/`** — pure functions: `attention.ts`, `amplification.ts`, `media.ts` exposing
`getAttentionMetrics(posts)`, `getAmplificationMetrics(amps)`, `getMediaMetrics(media)`.
Definitions and eligibility rules are in `docs/DATA.md §10`.

**`src/lib/format/`** — `number.ts`, `date.ts`:

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
/evidence     browsable list of posts / amplifications / media / milestones — a simple table is enough
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
Sitemap covers the five routes; robots indexes public routes only.

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

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "validate:data": "tsx scripts/validate-data.ts",
  "check:production-data": "tsx scripts/check-production-data.ts",
  "enrich:twitter": "tsx scripts/enrich-twitter-posts.ts",
  "import:press": "tsx scripts/import-layoffhedge-press.ts"
}
```

Pre-deploy pipeline:

```bash
pnpm validate:data && pnpm check:production-data && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

While fixtures are intentionally present, `check:production-data` is expected to fail — say so
explicitly rather than hiding it.

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

---

## 10. CI

GitHub Actions on `pull_request` and `push: main`:

```text
install → validate:data → check:production-data → typecheck → lint → test → build
```

A PR with invalid production data must fail. No git hooks in V1 — CI is enough.

---

## 11. Deployment

Vercel (GitHub integration, preview deployments per PR). Stay portable — do not design around the
provider. Cloudflare remains a later option.

Preview review checklist: 1440 / 768 / 390, motion, source links, no placeholder production data.

Env vars: aim for none in V1 (`NEXT_PUBLIC_SITE_URL` at most). Public content belongs in
`project.json`, never in env vars. Analytics optional, privacy-respecting, never blocking.

Browser support: current Chrome, Edge, Firefox, Safari, Mobile Safari, Chrome Android.

---

## 12. Maintenance tool — `pnpm enrich:twitter`

`scripts/enrich-twitter-posts.ts`. **One-time / occasional development tool. Never production runtime.**
Must not be called during `next build`, rendering, or CI.

Purpose: fetch public tweet text/metadata for URLs already in `data/posts.json` (and evidence URLs
in `data/amplifications.json`) to normalize:

```text
posts:          published_at · title · subject · summary · tags
amplifications: action · related_post_id · entity_name · account · date
```

Process: extract the status ID from each URL → fetch → confirm `published_at` → read source text →
write a neutral archive title, subject, short factual summary and a few tags → validate the record.

**Preserve manually observed metrics** (`metrics.views/likes/reposts/replies/observed_at`) by default.
A metric refresh must be opt-in (`--refresh-metrics`) and must update `observed_at`.

Rules: credentials from `X_BEARER_TOKEN` in `.env.local` only — never committed, logged, placed in
JSON, or exposed to the browser. Raw API responses go to a gitignored `.cache/twitter-enrichment.json`,
never into canonical JSON. Support `--dry-run`, retries with backoff, rate-limit respect,
per-record failure isolation, a backup before bulk writes, and safe re-runs.

Never invent content when a tweet cannot be fetched, is deleted, or is ambiguous — flag it and leave
the record `needs_review`. Never infer `quote_post` / `repost` / `reply` / `mention` when the API
response does not support the classification.

Report per record: `tweet ID · fetch status · old title · new title · subject · published_at · notes`,
then run `validate:data`, `typecheck`, `test` and review the diff before committing.

---

## 13. Maintenance tool — `pnpm import:press`

`scripts/import-layoffhedge-press.ts`. One-time / occasional seed of `data/media.json` from
`https://layoffhedge.com/press`. **Never fetched at build or runtime.**

Extract where available: publication · title · author · published date · article URL · short factual
context. Normalize into the media schema, deduplicate by canonical article URL, preserve existing
manually reviewed records, and mark every new import `status: "needs_review"`.

Report: records discovered · added · duplicates skipped · missing article URLs · needing review ·
publication counts. Then run `pnpm validate:data` and promote sound records to `verified` manually.

---

## 14. Future backend trigger

Introduce a backend only for: authenticated contributor workflow, high-frequency automated
ingestion, a dataset needing indexed search, official first-party analytics integration, moderation
that GitHub cannot handle, or server-side secrets. Until then, stay static — and keep the frontend
data contract stable so future ingestion writes the same records.

---

## 15. Technical acceptance checklist

- [ ] App Router · strict TypeScript · static core content · no backend
- [ ] JSON schema-validated; duplicate IDs, broken references and placeholders rejected
- [ ] Headline metrics derived
- [ ] Mobile intentionally implemented; reduced motion supported
- [ ] Source links work; no live social embed required
- [ ] No unnecessary client-side data fetching
- [ ] typecheck, lint, tests, data validation and build all pass
- [ ] Preview deployment visually reviewed at 390 / 768 / 1440
