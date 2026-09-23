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
├── docs/            USING PRODUCT DESIGN HOMEPAGE DATA ENGINEERING EDITORIAL WORKPLAN HISTORY + archive/
├── data/            posts.json amplifications.json media.json project.json
├── public/
│   ├── images/      posts/ people/ media/
│   └── og/
├── scripts/         validate-data.ts  check-production-data.ts
│                    enrich-twitter-posts.ts  import-layoffhedge-press.ts
│                    check-media-mentions.ts  sweep-quote-tweets.ts  sweep-mentions.ts
│                    sweep-web.ts  review-paid-profiles.ts  refresh-post-metrics.ts
│                    visual-check.mjs
├── src/
│   ├── app/         layout.tsx page.tsx archive/ evidence/ methodology/ about/
│   ├── components/  layout/ editorial/ data/ archive/ ui/
│   ├── lib/         data/ metrics/ format/ validation/ sweep/
│   ├── schemas/     post.schema.ts amplification.schema.ts media.schema.ts project.schema.ts
│   ├── styles/
│   └── types/
├── tests/
└── research/            paid API data + the working files behind it (gitignored, NOT a cache)
```

`research/` exists because `.cache/` is disposable by convention and some of what is in there cost
money and cannot be re-obtained — a profile's follower count and bio are readings of a moment, the
same argument `docs/DATA.md §5` makes about view counts. `research/README.md` records what each
file cost and whether it is replaceable. Raw API responses still go to `.cache/`; what survives a
run and was paid for goes to `research/`.

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

**`src/lib/sweep/`** — the same arrangement for the discovery tools: `quote-candidates.ts` holds
the judgements `pnpm sweep:quotes` makes about a quote post (is this a quote of *this* post, is
this account already recorded, what is worth a human's attention) as pure functions with no I/O.
Nothing the site renders imports it. It lives here for the reason `validation/` does — the
decisions that shape what a maintainer is asked to read are testable without spending an API
budget to exercise them (§18).

**`src/lib/format/`** — `number.ts`, `date.ts`, `country.ts` (ISO-2 to a display name, falling
back to the code), `cited-work.ts` (the B16 `cited_work` enum as the reader's words, with `none`
deliberately unlabelled — a reference that names no work is described by the sentence counting it),
`media-descriptors.ts` (the B13 record attributes as words, shared by the
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
Sitemap covers the five routes; robots indexes public routes only (built at B9, `src/app/
sitemap.ts`, `src/app/robots.ts` — both need an absolute canonical URL, which is why they moved
here from B6 at the 2026-09-18 maintainer decision, `docs/WORKPLAN.md`). Both read `SITE_URL`
(`src/lib/site-url.ts`), the single source of truth for that URL — `NEXT_PUBLIC_SITE_URL` if set,
else the canonical Vercel deployment. The five routes each carry their own `metadata` (title,
description, OG/Twitter text fields, as of B6, plus the OG/Twitter image as of B9 — every route
that declares its own `openGraph`/`twitter` object repeats an explicit `images` pointer at the
root `opengraph-image.tsx` / `twitter-image.tsx` route, rather than relying on inheritance: Next
only auto-applies a file-convention image to a segment that declares no `images` key of its own,
and that check does not cascade past a child segment that redeclares the object — verified in the
built HTML, where omitting this left `/archive`, `/evidence`, `/methodology` and `/about` with no
`og:image`/`twitter:image` at all while `/` kept the root's).

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
  "import:press": "tsx scripts/import-layoffhedge-press.ts",
  "check:media-mentions": "tsx scripts/check-media-mentions.ts",
  "sweep:quotes": "tsx scripts/sweep-quote-tweets.ts",
  "check:visual": "node scripts/visual-check.mjs",
  "review:profiles": "tsx scripts/review-paid-profiles.ts",
  "sweep:mentions": "tsx scripts/sweep-mentions.ts",
  "sweep:web": "tsx scripts/sweep-web.ts",
  "refresh:metrics": "tsx scripts/refresh-post-metrics.ts"
}
```

`check:visual` is the browser review pass — see §16. `check:media-mentions` is the press-queue
probe — see §17. `sweep:mentions` is the Track A mention sweep — see §18a; verification is a stage
of both tracks — see §18b; and keeping every billed response is the tools' job — see §18c.
`sweep:quotes` is the Track B quote-post sweep — see §18. `review:profiles`
re-reads profiles already paid for and **makes no network request at all** — see §19.
§20 covers field-name hygiene across every script.
`sweep:web` is the web-search discovery sweep — see §21; it is the only tool here that talks to a
second paid vendor. `refresh:metrics` is the manual metric refresh — see §22; it is the one tool
that appends to `data/`. Both make no request at all in their default mode.

**This block is generated from `package.json`, not maintained beside it.** It had drifted by two
entries — `review:profiles` and `sweep:mentions` both existed
and neither was listed — which is the ordinary fate of a list copied by hand. If you add a script,
paste the whole `scripts` object again rather than appending a line.

None of the maintenance tools is part of the pre-deploy pipeline below: `check:visual` must not
run alongside a build, and the rest make outbound requests to third-party services.

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

### A test over the live `data/` files asserts relationships, not values (B10)

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
and the figures are then re-derived and read by a human, never pasted from the run that failed.
B18 and B16 are the two migrations so far: B16 added a required `cited_work` to every media
record, which the fixture's own copies needed before they would parse again.

**Every live-data test is now in this shape.** B10 converted `tests/evidence.test.ts`,
`tests/media-contract.test.ts` and `tests/public-references.test.ts`. The last three,
`tests/attention-grid.test.ts`, `tests/archive.test.ts` and `tests/observations.test.ts`, pinned
post figures and were converted on 2026-09-23 with `refresh:metrics` (§22). The probe that
established it applied a real reading to all 32 posts: three tests failed, in `attention-grid` and
`observations`. `archive` stayed green only because no post had crossed 5M, and was converted
anyway. After the conversion the suite passed both with the reading applied and without it. Their literals moved to
the frozen fixture, and one of them became a stronger live check than it was: every frozen
reading must still head its post's history, which is the append-only rule tested against the file.
If a new test reads `data/`, write it this way from the start, and re-run the probe (change the
data, run the suite, restore) rather than trusting this paragraph.

---

## 10. CI

GitHub Actions on `pull_request` and `push: main`:

```text
install → validate:data → check:production-data → typecheck → lint → test → build
```

A PR with invalid production data must fail. No git hooks in V1 — CI is enough.

`.github/workflows/ci.yml`, one `verify` job on `ubuntu-latest` with pinned actions. pnpm comes
from the `packageManager` field in `package.json`, so the version is declared once. First green
run: 2026-09-18, all six steps executed.

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
lag far behind it — on 2026-09-18 the CI run finished green while no deployment existed at all,
and the site still served the previous build thirteen minutes later. Vercel registers a deployment
on GitHub only once the build actually starts, so during that window the GitHub API reports
nothing rather than "queued", and absence there is not evidence of a lost webhook. The Vercel
dashboard is the only reliable source in that window. Verify the live site after a push instead of
assuming it followed.

Preview review checklist: 1440 / 768 / 390, motion, source links, no placeholder production data.

Env vars: `NEXT_PUBLIC_SITE_URL` only, and optional — it overrides the fallback in
`src/lib/site-url.ts`. Public content belongs in `project.json`, never in env vars. Analytics
optional, privacy-respecting, never blocking.

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

**Never touch a stored observation.** Post readings live in `post.observations`, an append-only
history (`docs/DATA.md §5`, B18): the enrichment pass leaves them alone entirely. Refreshing them
is a separate tool, `pnpm refresh:metrics` (§22). The `--refresh-metrics` flag this script once
declared was never implemented; it now stops before any request and points there.

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

---

## 16. Maintenance tool — `pnpm check:visual`

The browser review pass for any batch that renders UI. A maintenance tool, never production
runtime. Requires the maintainer's consent for the session first (`docs/WORKPLAN.md`, rule 3).

**Why it is a script and not an ad-hoc run.** This machine has 8 GB of RAM and, until
2026-09-17, a 1.44 GB pagefile. An ad-hoc review that ran `pnpm build`, `pnpm start` and five
browser contexts at once — taking full-page screenshots at `deviceScaleFactor: 2` of a
~7,460 px page, roughly 86 MB per raster — bugchecked the VPS with
`0x000000EF CRITICAL_PROCESS_DIED`. The sequence below is the fix, and the script enforces it
so it cannot be improvised again.

**One thing at a time:**

```text
1. debug    code checks finish FIRST, as separate commands:
            pnpm typecheck && pnpm lint && pnpm test && pnpm validate:data
            && pnpm check:production-data && pnpm build
2. server   started alone; nothing else runs while it is up
3. screens  one browser, one context, deviceScaleFactor 1, viewport-sized captures
4. close    browser first, then the server, then verify the port is free
```

The script refuses to start if under 3 GB of RAM is free, if no `.next` build exists (it never
builds — that is step 1's job, already finished), or if something is already serving port 3000.

**What it asserts,** at 390 / 768 / 1440 plus a reduced-motion and a no-JavaScript pass:
no horizontal overflow, and no element left below full opacity once the reveals have settled —
content that needs motion to become readable would violate `docs/DESIGN.md §8`.

```bash
pnpm check:visual                    # 390 / 768 / 1440, output in .visual-check/
pnpm check:visual --widths 390,1440
pnpm check:visual --path /archive
pnpm check:visual --anchor archive   # a section below the fold
pnpm check:visual --out ./review-shots
```

`--anchor <id>` appends a URL **fragment** rather than scripting a scroll, so the same capture
works in the no-JavaScript pass, where `page.evaluate` cannot run at all. It is what makes a
below-the-fold section reviewable: every capture stays viewport-sized, and `fullPage` on a tall
page is what took the machine down in the first place. Anchored sections carry
`scroll-margin-top` (`globals.css`) so the sticky nav does not cover the section heading.

`--anchor` also reaches **inside a closed `<details>`**: current Chromium expands one when it
navigates to a fragment within it, so `--anchor media-ibtimes-uk-2026-08-25` captures that
publication row already open. This is the only way an expansion panel is reviewable at all — the
script never clicks. It needs the element to have an id: the Public References references carry
their record id for this reason among others (`docs/DESIGN.md §6`). Verified at B8, including in
the no-JavaScript pass, where the expansion is native and the auto-expand still applies.

Every screenshot is prefixed with the route (and anchor) it came from —
`home-1440-top.png`, `archive-390-top.png`, `home-archive-no-js.png`. Reviewing two routes in one
session otherwise had the second run silently overwrite the first run's reduced-motion and no-JS
captures.

**Run it from PowerShell, not Git Bash.** MSYS rewrites a `--path /archive` argument into a
Windows path (`C:/Program Files/Git/archive`) before the script ever sees it, and
`MSYS_NO_PATHCONV=1` then breaks the pnpm shim's own module resolution instead.

The opacity assertion reports *which* elements are below full opacity (tag, id, class, computed
opacity, animation name), not just how many — a bare count cannot be acted on, and chasing one
down otherwise means an improvised second browser run, which is the thing this script exists to
prevent.

Screenshots land in `.visual-check/` (gitignored) and are for a human to look at — the script
checks what is measurable, not whether the page looks good. Reading them is still the reviewer's
job.

**Never:** `fullPage` on a tall page, `deviceScaleFactor: 2`, more than one browser context, or
a build/test run while the browser is open. MSYS `pgrep`/`pkill` enumerate nothing on this
machine — use PowerShell `Get-Process` / `Stop-Process` for cleanup.

---

## 17. Maintenance tool — `pnpm check:media-mentions`

`scripts/check-media-mentions.ts`. **Occasional tool, never production runtime or CI** — it makes
outbound requests to third-party publishers.

**Strictly read-only.** It fetches each selected page and reports whether the page's own text
names this project. It never writes to `data/`. Promotion stays a human edit, because the tool
cannot do the thing that actually matters.

```bash
pnpm check:media-mentions                              # every needs_review record
pnpm check:media-mentions -- --id media-forbes-…       # one record
pnpm check:media-mentions -- --urls <file>             # a plain list of URLs in no file yet
pnpm check:media-mentions -- --limit 10 --delay 1500
pnpm check:media-mentions -- --no-proxy                # direct requests only
```

**Two inputs, one core (B11).** The tool could only select records *already in* `data/media.json`.
A discovery sweep starts from URLs that are in no file by definition, and B14 had already paid for
the gap twice — two throwaway scripts inside the batch, one for five press cards and one for 23
outlet about-pages, each reimplementing this same direct→proxy fetch. `--urls <file>` reads one URL
per line, `#` comments and blank lines ignored, anything after the URL taken as the label; the web
sweep of §21 writes exactly that file. The fetch-and-detect half both modes share is
`src/lib/sweep/page-probe.ts` and what counts as a mention is `src/lib/sweep/mention-patterns.ts`
(§18d), so selecting the targets is all the script still does.

**What counts as the name, and why the list grew.** The detector looked for `layoffhedge` and
`@?layoffai`. Counted over `data/media.json` as it stood when B11 began: `layoffhedge` 83, `layoffai` 99, **`layoff hedge`
zero** — the spaced form is absent from our data because the official press page never uses it, and
the open web does. Measured live on 2026-09-22: the yourNEWS piece that names this project four
times contains **zero** occurrences of the closed form and four of `Layoff Hedge`, so the old
detector reported the best candidate of the discovery probe as carrying no mention at all. A
detector calibrated on the press page is calibrated on the sample B11 exists to leave behind.

**Brand forms and weak forms are counted apart, and the report keeps them apart.** `layoffhedge`
and `layoffai` do not occur by accident. `official layoff` — the X account's display name — and
"layoff AI" spaced both occur in ordinary layoff reporting, so a page whose only hit is one of
those is listed as *a reason to read the page*, never as a reference. Each result also carries the
sentences around its first matches, because the tool's whole claim is that the human reading starts
from a located mention.

**A mention is not a verification, and the tool says so every run.** A hit means a form of the name
is on the page — it could be a sidebar, a related-links rail, an unrelated quote. `docs/WORKPLAN.md`
B14's bar is unchanged: the article itself is read before a record is promoted, and `country`,
`provenance` and the featured criterion are filled in the same edit (`docs/DATA.md §7`). What the
tool buys is that the reading starts from a fetched page with a located mention rather than from
a bare URL.

**Two things it took a measurement to learn** (2026-09-19, `docs/HISTORY.md`):

- **The `403`s are not a wall.** Sixteen of the 82 press-queue URLs refuse a direct request
  (BeInCrypto, Financial Express, Sportskeeda, ROI-NJ, Iowa Capital Dispatch and others). Every
  one of them is retrievable through `r.jina.ai`, so the tool falls back to it on a non-200 —
  and also when a page returns `200` with no mention, which catches client-rendered articles
  whose text is not in the served HTML.
- **The two requests need different headers, and getting this wrong silently disables the
  fallback.** A publisher refuses a default agent, so the direct request carries a browser
  user-agent; the proxy refuses *that* user-agent with a `403` of its own. Sending browser
  headers to both made every blocked record report as "not retrievable" when the proxy would
  have returned it — the first version of this script shipped that way and the smoke test caught
  it. Direct and proxy headers are separate constants for that reason.

Pacing defaults to 3 s between records because the proxy throttles a burst, and a throttled
response is indistinguishable from a hard block in the report.

The per-target report is written to the gitignored `.cache/media-mentions.json`, and the
extracted text of every page a run fetched to `.cache/pages/<target-id>.txt` — never into
canonical JSON. The text is kept because the tool's whole claim is that the reading starts from
a fetched page with a located mention: storing only the counts made the reader fetch the same URL
a second time to do the reading the counts exist to enable (added at B14, 2026-09-19).

---

## 18a. Maintenance tool — `pnpm sweep:mentions` (Track A)

`scripts/sweep-mentions.ts`. **Occasional discovery tool. Never production runtime.**

```bash
pnpm sweep:mentions                          # size the window with counts ($0.01 per 31 days) and stop
pnpm sweep:mentions -- --sweep                # actually fetch, profile and report
pnpm sweep:mentions -- --since-id <id>        # override the stored high-water mark
pnpm sweep:mentions -- --start-time <ISO>     # a date window instead of an id
pnpm sweep:mentions -- --sweep --dry-run      # fetch, report to stdout, write no files
```

Purpose (`docs/WORKPLAN.md` B10, Track A): a full-archive search over every post whose **text**
names the account, the brand word or the domain. It is the complement of `sweep:quotes`, and the
two barely overlap — 0 of the 10 pre-existing records were findable by Track A, because a quote post
attaches a card rather than text. Track A finds outlets and commentators; Track B finds the
officeholders.

**Sizing is the default and spending is opt-in.** An unqualified run makes one `counts` request,
prints what the window holds and what a sweep would cost, and stops. Only `--sweep` bills.

**The incremental state lives in `research/track-a-state.json`** — the `since_id` high-water mark,
the window covered, and one line per run. It is written only after a successful sweep, from the
API's own `newest_id`, and only ever forwards: a mark that moves backwards re-buys a paid window,
and one that moves forwards after a failure silently skips posts nobody has seen.

**Strictly read-only against `data/`,** like every discovery tool here. It reports candidates and
prints, for each, the claims that must be confirmed **against a source that is not the account** —
see §18b.

Why it exists as a script at all: it produced five records over two sessions as hand-assembled
`curl` lines, which is how the field-name bugs in `docs/X-API.md §16` happened. A committed script
is covered by `tests/api-field-validity.test.ts`; a `curl` line is covered by nothing.

---

## 18b. Verification is a stage of the discovery tracks

Both tracks emit, per candidate, what a human must confirm and where —
`verificationClaims()` in `src/lib/sweep/quote-candidates.ts`, shared so a rule fixed in one track
is fixed in both.

It returns **a claim and its test, never a verdict**, because no amount of profile data can
establish a role. The calibration sweep is the evidence that this has to be mechanical: three
accounts whose bios claimed a journalistic role split three ways when checked against the outlets —
one recorded as `journalism`, one recategorised to `politics` because the network's own page calls
her a commentator rather than a journalist, and one rejected for having no masthead anywhere.

Every candidate, flagged or not, also carries the check that has disqualified the most accounts so
far: **read the post**. A bare link, a slogan or a reproduction of someone else's article carries no
act of its own and is archived regardless of who posted it.

---

## 18d. The shared sweep modules

The discovery tools are thin scripts over the pure modules in `src/lib/sweep/`, which is what
makes a rule fixed in one tool fixed in the others:

| Module | Owns |
|---|---|
| `quote-candidates.ts` | who is already known, the role-phrase and following signals, the self-account exclusions, and `verificationClaims` (§18b) |
| `legislator-index.ts` | the Congress register — CSV parsing, and matching an account by name, handle or account id |
| `profile-store.ts` | recognising a paid user object and folding readings newest-first, so nothing is bought twice |
| `raw-archive.ts` | where a billed response goes the moment it arrives (§18c) |
| `mention-patterns.ts` | what counts as this project's name on someone else's page, brand forms apart from weak ones (§17) |
| `page-probe.ts` | the direct→proxy fetch-and-detect core both input modes of §17 share |
| `url-list.ts` | the `--urls` file format, and a readable unique id per target |
| `web-search-results.ts` | normalising a result URL, diffing it against `data/media.json`, and the archive-on-sight verdict (§21) |
| `web-queries.ts` | the versioned query set of the web sweep, and why each query is worded as it is (§21) |
| `cost-ledger.ts` | the record of spend — one entry per billed request, the free verification passes beside it, and per-query yield across every run (§21) |
| `sweep-state.ts` | the web sweep's per-query high-water marks, and the rule that a new or reworded query is swept unrestricted (§21) |

They live in `src/lib` rather than `scripts/` for the same reason
`src/lib/validation/placeholder.ts` does: they are pure, they are unit-tested without a disk or an
API, and the decisions they encode are the ones a silent bug would be most expensive in. Two such
bugs were found on 2026-09-21, both in this directory and both shared by both tracks — a surname
floor that hid twelve sitting members of Congress, and a profile recogniser that filed @-mentions
as paid profiles and thereby suppressed real purchases.

---

## 18c. Keeping what you paid for is part of the tools, not a habit

`src/lib/sweep/raw-archive.ts`, used by both discovery scripts.

**Every billed response is written to `research/` before it is parsed.** The
`fetchJson` helper in each script takes a `label` and archives the body on the way through, so the
only way to not keep a response is to delete the call. The file lands at
`research/x-api-<day>/raw/<label>-<hhmmss>.json` and carries when, which endpoint, why, and the
untouched body.

**Persist before parsing**, because a request that was misunderstood and a field that is genuinely
absent look identical once the response is read away — and this API answers an unknown field name
with HTTP 200 and silence (`docs/X-API.md §15–§16`).

**The endpoint is stored as a path, never the full URL.** A query string can carry credentials, and
§8's rule that a token is never written anywhere includes files nobody intended to publish. Covered
by a test that asserts a secret in a query cannot reach the archive.

**Why it is a module.** `research/README.md` always said paid data is not disposable and both
scripts always wrote their main payload there — and it still was not enough, twice:

- **a billed call nobody had covered.** `sweep:mentions` sizes its window with `counts` on every
  run, the default and most frequent mode, and printed the answer without keeping it. That reading
  is the historical size of the mention population on a given day and cannot be re-taken.
- **ad-hoc probes had ad-hoc storage.** On 2026-09-21 five hand-assembled `curl` probes — $0.12 of
  `counts` and `/2/news/search` calls — spent hours in a session scratchpad that gets wiped.

A convention each caller re-implements is a convention each caller can forget. The metering
endpoint (`usage/credits`) is the one deliberate exception: it returns a balance rather than billed
content, and passes `null`.

---

## 18. Maintenance tool — `pnpm sweep:quotes`

`scripts/sweep-quote-tweets.ts`. **Occasional discovery tool. Never production runtime.**
Must not be called during `next build`, rendering, or CI.

```bash
pnpm sweep:quotes                                   # measure only — one request
pnpm sweep:quotes -- --post <post-id|status-id>     # sweep one post
pnpm sweep:quotes -- --all --max-pages 5            # walk the set, largest first
pnpm sweep:quotes -- --post <id> --dry-run          # no report file written
```

Purpose (`docs/WORKPLAN.md` B10): enumerate the accounts that quoted a tracked post, drop the ones
already recorded, and report the rest so a human can read them. All four federal legislators in
`data/amplifications.json` surfaced by accident; this makes the search systematic instead of lucky.

**Strictly read-only against `data/`.** It never writes an amplification. Promotion is a human edit
— the same line `check:media-mentions` holds, and for a stronger reason: a discovery sweep is where
auto-promotion would do the most damage, because nothing upstream has vouched for the record.

`--measure` is the default, so an unqualified run costs one request rather than a budget. The pure
decisions live in `src/lib/sweep/quote-candidates.ts` and are tested in `tests/quote-sweep.test.ts`,
which is why a sweep can be reasoned about without spending anything.

**What it filters, and why twice.** The endpoint's timeline is mostly not quotes of the post:
measured 2026-09-20, 94 of the first 96 entries on the highest-quote post were plain retweets, and
with `exclude=retweets` applied the next 392 entries still resolved to 199 quotes and 151 replies.
So the request excludes retweets and the tool then checks that `referenced_tweets` carries
`quoted → this post`. A retweet is also the wrong record on its own terms — someone else's quote
post travelling is an act belonging to whoever wrote the quote, which is B14's standing rule about
a surface that carries no act of its own.

**Flags are signals to read, never a ranking.** `government-verified`, `role-phrase` and
`large-following`, printed as words. No score, no order of merit — `CLAUDE.md §3` bans invented
Influence and Attention numbers, and a maintenance tool is not an exception. An unflagged account
is not thereby uninteresting, which is why every account reaches the report file.

**The binding constraint is an API credit budget, not the rate limit** (measured 2026-09-20). The
`quote_tweets` rate limit is 75 requests per 15 minutes and a full sweep is ≥69 pages, so the rate
limit alone would cost two or three windows. What actually stops a run is separate: after ~14
requests the account returned `402 credits depleted` on **every** v2 endpoint, tweet lookup
included, while rate-limit headers still reported 3 496 and 60 remaining. The two budgets are
independent, the credit one is much smaller, and waiting does not clear it. `--max-pages` (default
10) caps what a run can spend.

A failure mid-pagination **keeps the pages already paid for** and records why it stopped in
`stoppedBy`. This is not defensive habit: the first real sweep lost 274 already-collected accounts
to a `402` on the seventh page, because the throw escaped the loop. Where the budget is the scarce
resource, discarding completed work on the next call's error is the expensive bug.

**Two phases, because the two costs are separate** (added 2026-09-20). Enumeration is billed per
post returned, profiles per user returned. Phase one pages with **no `expansions`** — `author_id`
is a tweet field and rides along free, whereas the expansion attaches a user object on every page
the same account appears on. Phase two resolves profiles in one batched `/2/users?ids=` call for
the top `--profiles` accounts (default 30), ranked by the engagement of their own quote post — a
property of the post, never a claim about the person. Authors enumerated but not profiled keep
their ids in the report, so a later run describes them without re-paying to find them.

**Output goes to `research/`, not `.cache/` — corrected 2026-09-21.** Per-post reports are written
to `research/quote-sweeps/<status-id>.json`. They used to go to `.cache/quote-sweep/`, which
contradicted the rule stated in the very next sentence of this section: `.cache/` sits beside
`.next/` in `.gitignore` and is cleared without thought, while a sweep report holds paid
enumeration — author ids, quote text, profile readings — that cannot be re-obtained as the same
reading at any price. Never into canonical JSON either way. Credentials come from
`X_BEARER_TOKEN` in `.env.local` only — never committed, logged, placed in JSON, or exposed to
the browser.

**Nothing paid for is ever bought twice.** Every profile the tool receives is written to
`research/x-api-profiles.json`, keyed by account id and stamped with the date it was read. Before
phase two spends anything the store is consulted, and the run reports what it reused and what that
saved. The store is also **rebuilt from every `.json` under `research/` on each run**, not merely
loaded: a profile sitting in some older research file that the store never learned about would
otherwise be re-bought at $0.010 with nothing reporting that it was already held. The failure is
silent and shows up as a bill, so the rescan is unconditional.

Profiles are stored with `observed_at` and merged newest-first: a follower count is an observation,
not a fact (`docs/DATA.md §5`), and an undated reading never displaces a dated one.

**The register match.** The tool matches each profiled account against the free
`unitedstates/congress-legislators` register, current **and** historical, on the display **name**
rather than the handle. Measured 2026-09-21 against the eight federal legislators in `data/`:
name matching caught 8 of 8, handle and account-id matching caught 2 — the register records
taxpayer-funded official accounts only, so personal accounts, second official handles and every
former member are invisible to both. False positives run 0.67%. A match is a reason to look, never
a verification; and a *miss* is evidence about nobody, since no congressional register contains
state legislators or executive-branch appointees, both of which this dataset holds.
See `docs/X-API.md §7`.

**The full cost model, operator list and discovery procedure are in `docs/X-API.md`.** It is not
about this site and is deliberately kept local; read it before any further X API work. The short
version: billing is per resource returned, `GET /2/usage/credits` reports the balance in USD so a
run can be priced exactly, resources deduplicate within 24h, and full-archive search **cannot see
quote posts** — which is why this tool exists and a search cannot replace it.

---

## 19. Maintenance tool — `pnpm review:profiles`

`scripts/review-paid-profiles.ts`. **Makes no network request of any kind.** Read-only against
both `data/` and `research/`; it never writes a record and never edits a paid file.

```bash
pnpm review:profiles                  # every account meeting at least one criterion
pnpm review:profiles -- --floor 1000  # lower the follower criterion
pnpm review:profiles -- --all         # print every account, criterion or not
```

It re-reads every profile the project has already paid for — recovered from every `.json` under
`research/`, whatever shape that file happens to use — and reports which accounts a human should
look at, with the criterion that fired.

**Why it exists as a script rather than a one-off.** `research/` grows with every sweep and the
review criteria have already changed twice. A stored pass can be re-run across the whole corpus
whenever a criterion moves, instead of leaving a human to remember which files were screened under
which rule. The reading is free; only the data was expensive.

**The criteria, and why each one is there:**

```text
register match          matched a U.S. legislator by name, handle or account id
government verified_type the one verified_type that names an office
role phrase             the account described a public role in its own words
followers >= 5,000      Track A's reading floor, not a new invention
```

The follower floor is inherited, not chosen here: Track A checked all 210 authors below 5,000 and
found 16 with a role phrase and none with weight. It applies **only** to the follower criterion — a
register match, a `government` verified_type or a role phrase is reported at any account size,
because the one officeholder ever measured in a sweep had 13,924 followers and would clear no
sensible "large account" bar.

The run prints **each criterion's own yield**, so a criterion that never fires can be retired on
evidence rather than kept because it sounds prudent. Read on 2026-09-21 across 448 accounts not
already recorded: register match 3, government 0, role phrase 20, followers ≥5,000 55.

A register match is a reason to look, **not** a verification — names collide, and the historical
register holds twelve thousand people. Identity is confirmed from independent sources, off-API, by
a human (`docs/X-API.md §9` step 4).

---

## 20. API request hygiene — and two one-off scripts

**Every field name a script sends is validated against the X API's OpenAPI spec by
`tests/api-field-validity.test.ts`.** This is not ceremony: X ignores an unknown field value
silently — HTTP 200, `errors: []`, field simply absent — so a wrong spelling looks exactly like a
right one in the code and produces a bill either way. Two real bugs were found this way
(`docs/X-API.md §16`), one of which had already been written up as an API limitation when it was
our own request. The test resolves interpolated constants, so a field list held in a `const` is
checked too, and it skips when the spec file is absent because `research/` is gitignored.

The two rules that go with it: **keep the raw response body** beside anything derived from it, since
a missing field and an ignored request are indistinguishable downstream; and **assert on page one**
that the fields a paginated run depends on actually arrived, because a run that pages on regardless
bills for the whole post and reports nothing.

`pnpm probe:fields` (`scripts/probe-field-parameter.ts`) and `pnpm refetch:truncated`
(`scripts/refetch-truncated-posts.ts`) were two one-off measurements — settling which
`*.fields` vocabulary the API actually honors, and re-fetching truncated Track A posts once that
was corrected. Both have done their job and been removed from `scripts/` and `package.json`; git
history keeps them, and the facts they established are recorded where the scripts that still rely
on them cite them.

---

## 21. Maintenance tool — `pnpm sweep:web`

`scripts/sweep-web.ts`. **Occasional discovery tool. Never production runtime, never CI.**
B11's discovery half: nothing in this repo queried a search engine before, and that was the only
genuinely new capability the batch had to build.

```bash
pnpm sweep:web                               # print the query set and its modelled cost; no request
pnpm sweep:web -- --sweep                    # run the set — this bills
pnpm sweep:web -- --sweep --query brand-closed          # one query, by exact label
pnpm sweep:web -- --sweep --query brand-closed,brand-spaced  # several, comma-separated
pnpm sweep:web -- --sweep --max-queries 5    # lower the ceiling; nothing can raise it
pnpm sweep:web -- --sweep --freshness py     # recency filter, vendor's own syntax
pnpm sweep:web -- --vendor serper-news --sweep --since-last --fetch   # Google News, alongside Brave
```

**Planning is the default and spending is opt-in.** An unqualified run makes **zero** requests. It
prints every query, why it is worded that way and what the set would cost. Only `--sweep` bills,
which mirrors `sweep:mentions` and `sweep:quotes`: a mistyped flag should cost nothing.

**`--query` takes exact labels, and that is a spend control rather than a style.** It matched
substrings until 2026-09-22, when `--query investigation-trine` also matched
`investigation-trine-backdoor` and a one-query probe made two requests. An unknown label now spends
nothing and prints the list of labels instead.

**The instrument is the claim, not the name.** Measured over six probe queries, 2026-09-22: a brand
query returns the project's own surfaces and outlets already in `data/media.json` — nine results,
zero candidates — while the claim that travelled ("9 of every 10 new American jobs") returned four
unknown domains from one query. So the query set is built from the story clusters the dataset
already records, which are the `cited_work` values of `docs/DATA.md §7`, and the brand queries are
kept as a **control**: they are how a zero-candidate run is told apart from an index that has never
heard of this project. Non-English discovery is unproven — a Spanish probe returned pure noise —
so the one Spanish query sits outside the default set and runs by name.

**The query set is versioned** (`QUERY_SET_VERSION` in `src/lib/sweep/web-queries.ts`) and every
report records the version. A different query set is a different population; two reports are
comparable only when the versions match.

**Billing exposure is the thing this design is against.** The vendor withdrew its free plan in
February 2026: a card is required, $5 of credit arrives monthly (≈1,000 queries at $5/1,000), and
**no default spending cap is applied**. So the script carries a hard ceiling of 60 queries per run
that no flag can raise, paces one query at a time, and **aborts on the first non-200 instead of
retrying**. Set a cap in the vendor dashboard too — a script's ceiling protects against that
script only.

**The vendor publishes no OpenAPI specification, and that is measured rather than assumed.** Six
candidate spec paths were probed on 2026-09-22 — every one 404s or 403s — the reference site is an
application whose HTML embeds no spec URL, and the vendor's own skills repository carries prose
files rather than a schema. `docs/X-API.md §0`'s rule (read the spec, believe it over our notes) has
nothing to point at here. The nearest thing is kept instead: dated copies of the vendor's own
parameter reference under `research/brave-search-2026-09-22/reference/`, and every parameter the
client sends was checked against them. **`tests/api-field-validity.test.ts` has no equivalent for
this vendor** — a gap worth knowing about rather than papering over.

**What that check corrected**, since the client was first written blind: `spellcheck` is a boolean
and is sent as `false` rather than `0` (an unknown *value* is the bug class that cost a paid page on
the other API); `text_decorations=false`, because the vendor otherwise injects highlight markers
into `description`, and those are markup inside the text this sweep string-matches;
`result_filter=web,news`, which keeps the two verticals that can carry an article and drops videos,
FAQs, discussions and infoboxes; and **the `news` results are parsed as well as the `web` ones**,
which they were not — a media-citation sweep that reads only `web.results` drops exactly the
population it exists to find. `count` is capped at 20 because the vendor caps it there, and the
query set needs no extra parameter for `"exact phrase"` and `-site:` because operators are applied
by default. `--extra-snippets` is opt-in rather than on: it returns up to five further excerpts per
result and may be plan-gated, and an unsupported parameter would abort the run on its first query.

**Metering, as measured on 2026-09-22 rather than as expected.** There is no balance endpoint, so
the meter is what the response itself reports. The headers exist and now have names:

```text
x-ratelimit-limit      50, 0
x-ratelimit-policy     50;w=1, 0;w=2592000      50 per second, and a 30-day window reading 0
x-ratelimit-remaining  49, 0
x-ratelimit-reset      1, 719977                 seconds to each window's reset
```

The per-second window behaves as documented. **The monthly window reads `0` limit and `0`
remaining while requests keep succeeding**, so it does not mean what a depleted counter would mean
on a metered plan; it is not yet understood and is recorded rather than interpreted. The
consequence stands either way: **the only true meter is the vendor dashboard**, and the figure the
script prints is a **model** ($0.005 × requests), labelled as one everywhere it appears.

**The model was checked against the meter on 2026-09-22 and matched**: the dashboard read 21
requests and ~$0.10 against a ledger of 21 requests and $0.105 modelled. That confirms the unit
price for this vendor on this plan and nothing more — a model that agrees once is still a model,
so the check is repeated after any plan change and recorded in the ledger's `verification` block.

**The ledger is the spend record** — `research/brave-search-ledger.json`, written **per request**
rather than per run, so a run that aborts halfway still records what it spent getting there. One
entry per billed request: when, endpoint, query-set version, query label, HTTP status, results
returned, unit price, modelled cost, the quota headers as they read at that moment, and whether
the entry was written live or reconstructed from `raw/`. `src/lib/sweep/cost-ledger.ts` owns it and
`summarise()` prints the running total after every sweep. A failed request counts as a request: the
vendor may well have billed it, and a ledger that drops the calls that went wrong understates spend
exactly where understating it is most expensive.

**Measured yield, first full sweep (14 queries, $0.070 modelled).** 97 distinct URLs → 13 already
in `media.json`, 12 own surfaces, 26 archive-on-sight, **46 candidates**. Fetching all 46 through
§17 — free — left **11 brand hits, of which 5 are pages that genuinely cite the project** and 4
were link-in-bio/mirror surfaces now in the archive-on-sight list. So the shape of this instrument
is roughly **$0.07 and one fetch pass per ~5 real candidates**, and the fetch pass is where the
precision comes from, not the query.

**`--fetch` chains the free verification stage onto the run**, so a sweep ends with "5 pages that
name this project" instead of "46 candidates". It fetches every candidate from its publisher —
which costs nothing, the search vendor is not involved — detects the name, prints the hits with
their surrounding sentence, and records the outcome per query in the ledger's `fetches` array.
The two stages stay separable on purpose: `check:media-mentions -- --urls` still runs on any list.
The outcome is appended rather than written back onto the billed entry it belongs to, because a
spend record is trustworthy exactly to the degree that nothing rewrites it afterwards.

**`--pages N` buys deeper pages, and the measurement says not to.** Only 3 of 13 queries had a
second page at all; the other 10 were exhausted at page 1. Tested on the two that had one **and**
had produced real hits: `daily-wire-layoffs` page 2 returned 20 results and 13 new candidates for
**0 new hits**, `investigation-trine` page 2 the same — 13 new candidates, and its only hit was the
one page 1 had already found. So the ranking puts the citing pages at the top and depth is
diminishing returns. The flag stays at **1 page by default**, a page is only ever bought when the
previous page's `more_results_available` says one exists, and pages count against
`HARD_QUERY_CAP` rather than queries — the ceiling has to bound the thing that is actually billed.

**`--since-last` is the cadence lever, and the mark belongs to a query rather than a run.**
`research/web-sweep-state.json` keeps a per-query high-water mark — the label, **the `q` that was
sent**, and the date it was last swept — and `--since-last` restricts each query to a date window
opening on its own last sweep. A query the state has never seen, or one whose wording has changed
since, is swept **unrestricted**: a window applied to a query that has never seen the archive
reports a clean nothing while skipping everything. That is the conservative direction and it costs
one full sweep of one query; the other direction costs a silent miss, which this project has
already had once from a reworded query. Marks move only forwards and only for queries that
answered 200, the rule `§18a` states for Track A. Verified live: a query swept minutes earlier
returned 0 results under its own window while a never-swept one returned its usual 4.

**Per-query yield measures itself** — `pnpm sweep:web -- --yield` reads the ledger and prints, per
query label, runs, results, how many were already records, how many were candidates, **how many
pages actually named this project** and what the label has cost across every run. It makes no
request. A label never fetched shows `—` rather than `0`, because zero would retire a query that
was never checked. Each ledger entry carries the verdict counts
of its own response and **the `q` actually sent**, because the first yield table showed
`investigation-trine` aggregated over three different wordings under one label — a row flagged
`REWORDED` is a sum over different questions and is not a yield. The point of the table is
retirement: a label that has cost money across several runs and returned neither a known record nor
a candidate is dead weight, and until this existed that could only be noticed by joining two
reports by hand.

**A cluster was added, run and retired on measurement — `COMPANY_STORIES`.** The query set covered
the territory of 31 of the 95 records verified at the time; the other 64 carried `cited_work: "none"` and are
overwhelmingly one shape, a company's layoffs where an outlet cites this project for a number the
company has not given (Meta in 23 of them). Four queries were derived from those records' own
figures and events and run for $0.020: **55 URLs, 45 candidates fetched, 0 brand hits.** The
queries are not at fault — each returned records already in the file (Forbes, Slay News, Alex Jones
Live, Geeks + Gamers), so they land on target. **43 of those 64 records carry the reference as an
embedded @LayoffAI post, against 8 in prose**, and an embed is a client-rendered card frequently
absent from the served HTML — the wall B14 already hit. A text index cannot reach that population
in principle. It is the web analogue of `docs/X-API.md §4`'s split: prose citers are findable by
search, embedders are findable through the post. The cluster stays defined and outside the default
set, runnable by name, so it reads as *answered* rather than untried.

**What the first full run corrected in the query set, which is why the set is versioned:**

- **A subject query returns the subject.** `"Gurukul Overseas" Trine` returned 19 results, 0 of them
  ours, mostly the agency's own website; `"H-1B" "zip code" lookup…` returned USCIS and university
  career pages. Both retired.
- **An exact figure is the best instrument.** `"273,026" H-1B renewals` returned 7 results of which
  4 are already records. `"8 of every 10 new American jobs"` — the post's own sentence — returns
  exactly one page, and it is one of ours.
- **A precision refinement failed its calibration, and the calibration is why we know.** Replacing
  the Trine subject query with `"9,123" Trine graduate students` looked strictly better — 5 results,
  3 known — and **silently dropped the second NewsBreak URL**, one of the two pages the run exists
  to re-find. Both queries are now in the set. Do not reword a query on reasoning alone; re-run the
  calibration after every edit.

**Every response is archived before it is parsed**, under `research/brave-search-<day>/raw/`
(§18c). `rawArchivePath` takes the vendor as its third argument for exactly this reason: two
vendors' bills do not belong in one folder.

**What it does with the results.** Each URL is normalised to one spelling, diffed against
`data/media.json`, and sorted into four buckets: the project's own surfaces, pages already in the
file, **surfaces carrying no reporting of their own** — archive on sight, `docs/WORKPLAN.md` open
question 14 — and candidates. Three of the first six probe queries returned the third shape, which
is what makes that rule load-bearing rather than precautionary. A syndicating outlet is *not* in
that bucket: a syndication of a named outlet's piece is a record under B13's contract.

The run writes `research/brave-search-<day>/sweep-<time>.json` and a
`candidate-urls-<time>.txt` in exactly the format §17's `--urls` reads, so the handoff to the
verification stage is a paste and not a transcription.

**Calibration, and it comes before the results are read as findings.** Two pages were confirmed by
hand on 2026-09-22 and are in no file: the yourNEWS piece of 2026-06-06/07 and the second NewsBreak
URL, a syndication of The American Bazaar's Trine investigation. Their URLs are kept in
`research/web-sweep-calibration.txt`. A sweep that does not return them has a problem in its query
set or its detector, and its other results are not yet a finding about the world.

**Two indexes, side by side — `--vendor serper-news`.** Google's index was put to the same
questions through Serper on 2026-09-23, to test whether it holds citations Brave's does not.
Neither index contains the other on this project's long tail:
- Of Brave's six real or calibration finds, Google returned one.
- Google **News** returned one citing publication that no Brave response ever held.
- Google **web** search returned nothing Brave lacked except noise.

So Brave's web search stays the default, Serper's `/news` runs alongside it, and Google web search
is not offered. `src/lib/sweep/web-vendors.ts` holds every difference between the vendors, and
`tests/web-vendors.test.ts` pins them.

- **Contract.** `POST https://google.serper.dev/news`, key in `X-API-KEY`, JSON body
  `{q, gl, hl, num, page, autocorrect, tbs}`. **Serper publishes no documentation and no OpenAPI
  specification**: `/docs`, `/openapi.json` and `/api-docs` return 404. The request shape and the
  credit rules were read out of the vendor's own playground bundle, of which dated copies are kept
  locally.
- **Free, and only while free.** 2,500 card-free credits, 1 per request. `GET /account` returns
  the balance and costs nothing. Before a run, the sweep reads the balance and refuses when it
  cannot cover the worst case (queries × pages). Running out is therefore a refusal rather than a
  bill, and topping the account up is a maintainer's decision, not a flag.
- **Metered, unlike Brave.** Every response carries `credits`, and each ledger row records it as
  `creditsInBody`. The balance lags a charge by seconds, so the run reads it again after a settled
  wait and prints the difference. On the first 27 requests the two agreed exactly.
- **Ten results a page.** The free tier answers `num` above 10 with HTTP 400 ("Query pattern not
  allowed for free accounts"), at no cost. `--pages` therefore defaults to **2** for this vendor,
  on the one measurement there is: its only real find was on page 2. Serper has no
  `more_results_available`. A second page is bought only after a full first one, and it can still
  come back empty, as it did once, at the cost of a credit.
- **`--since-last` works, but coarser than on Brave.** Google's custom date range
  (`tbs=cdr:1,cd_min:…,cd_max:…`) is accepted and echoed back by `/news`, and then ignored.
  Measured: a one-day window returned articles four months old, while `qdr:w` on the same query
  returned only that day's article. So the range is **rounded up** to the smallest fixed bucket
  that contains it: past week, month or year. A gap longer than a year sweeps unrestricted.
  Rounding up costs a few old results, which the dedupe absorbs. Rounding down would skip pages
  silently.
- **Some query patterns are refused on the free tier.** `"@LayoffAI"` and `"layoffhedge.com"`
  both answer HTTP 400, "Query pattern not allowed for free accounts", at no cost, while the bare
  token `layoffhedge` is accepted. The vendor lists the refused labels with the measurement behind
  each, and they are skipped before any request, so a run never aborts halfway on them.
- **An aborted run exits non-zero**, on both vendors. A scheduled run has no one reading its
  console.
- **A query set version names the questions, not the index.** The same `q` keeps its
  `QUERY_SET_VERSION` on both vendors. Each vendor has its own ledger
  (`research/serper-ledger.json`), its own raw folder (`research/serper-<day>/raw/news-<label>-…`)
  and its own state file (`research/web-sweep-state-serper-news.json`). Sharing a state file would
  let one index's date apply a window to a query the other index has never swept, and that window
  would report a clean nothing while skipping the archive. `--yield` counts only the vendor's own
  endpoint.

**Read-only against `data/`, like every discovery tool here.** It reports; a human fetches, opens,
reads and writes the record. A discovery sweep is exactly where auto-promotion would do the most
damage.

---

## 22. Maintenance tool — `pnpm refresh:metrics`, and the manual refresh routine

`scripts/refresh-post-metrics.ts`. Run by hand, never scheduled, never part of a build or CI: B12
keeps every refresh manual by maintainer decision.

```bash
pnpm refresh:metrics                                  # plan: no request, no write
pnpm refresh:metrics -- --fetch                       # buy one reading — ~$0.16 for 32 posts
pnpm refresh:metrics -- --from <file>                 # show a reading already paid for, free
pnpm refresh:metrics -- --from <file> --write         # append it to data/posts.json
```

**What it does.** One `GET /2/tweets?ids=` request per 100 tracked posts returns each post's
public counters. Each becomes one observation appended to that post's history with
`source: "api"` and the reading's own UTC date (`docs/DATA.md §5`, which owns the field mapping).
A post that already holds a reading on or after that date is skipped with the reason printed, so
re-applying the same reading changes nothing.

**Three steps, and only the last one writes.** The default mode prints the post count, the
request count, the modelled cost and any reading already paid for that is newer than everything
stored. `--fetch` buys a reading, meters `GET /2/usage/credits` before and after, archives the raw
response under `research/x-api-<day>/raw/` and saves the reading to `research/post-metrics/`,
then prints each post's latest stored figure beside the new one. `--from` prints the same table
from a saved reading. Only `--write` touches `data/posts.json`: it backs the file up to
`.cache/backups/`, validates the result against the schema, and keeps the file's formatting and
line endings, so the diff is the appended lines and nothing else.

**Why this is the one tool that writes to `data/`.** A discovery tool reports candidates, because
a candidate needs a person to verify it. A reading is a public counter on a post that is already
verified, and the one judgement in it — which counter maps to which field — is made once, in
tested code. It still writes nothing it has not printed first.

`sweep:quotes --measure` saves its reading to the same folder in the same shape, so a reading
bought by either tool can be applied with `--from`.

### The manual refresh routine

Everything the site shows can be brought up to date by hand, in this order. Each step is
optional and independent; run the ones that are due.

```bash
# 1. Post metrics — the headline numbers. ~$0.16, X API.
pnpm refresh:metrics -- --fetch
pnpm refresh:metrics -- --from tracked-post-metrics-<day>.json --write

# 2. New coverage — discovery only; nothing becomes verified until a person has read the source.
pnpm sweep:web -- --sweep --since-last --fetch                       # Brave, card, <= $0.065
pnpm sweep:web -- --vendor serper-news --sweep --since-last --fetch  # Serper, free credits
pnpm import:press                                                    # official press page, free; adds needs_review records
pnpm sweep:mentions                                                  # X mentions since the last run: sizes it, $0.01 per 31 days
pnpm sweep:mentions -- --sweep                                       # ...and fetches it, paid per post

# 3. Before committing any change to data/.
pnpm validate:data && pnpm check:production-data && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

**`sweep:mentions` after a long gap.** It resumes from the `since_id` in
`research/track-a-state.json`. What window the API applies to a `since_id` given with no
`start_time` is not documented, and a run cannot find out without paying. So when more than 30 days have passed since that file's `covered_through`, pass the date
explicitly: `pnpm sweep:mentions -- --start-time <covered_through>T00:00:00Z`, sizing first and
then with `--sweep`. The sizing follows every 31-day page, so its price is for the whole window.

After step 3, grep the committed docs for figures written by hand (`docs/DATA.md`,
`docs/HOMEPAGE.md`, `docs/PRODUCT.md` hold dated readings) and re-date any that the change moved.
The tests need no edit: every test over `data/` asserts relationships, and the literals live in
the frozen fixture (§9). A metric refresh changes numbers, not layout; whether a change warrants a
visual pass (`check:visual`, §16) is the maintainer's call. There is no date field to update by
hand anywhere in this routine — the footer, `/methodology` and the sitemap all read a date derived
from the refreshed data itself (`dataLastUpdated`, docs/DATA.md §10).
