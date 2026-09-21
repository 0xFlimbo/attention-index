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
│                    check-media-mentions.ts  sweep-quote-tweets.ts  visual-check.mjs
├── src/
│   ├── app/         layout.tsx page.tsx archive/ evidence/ methodology/ about/
│   ├── components/  layout/ editorial/ data/ archive/ ui/
│   ├── lib/         data/ metrics/ format/ validation/ sweep/
│   ├── schemas/     post.schema.ts amplification.schema.ts media.schema.ts project.schema.ts
│   ├── styles/
│   └── types/
├── tests/
├── research/            paid API data + the working files behind it (gitignored, NOT a cache)
└── references/visual/   (design references, not shipped)
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
back to the code), `media-descriptors.ts` (the B13 record attributes as words, shared by the
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
  "check:visual": "node scripts/visual-check.mjs"
}
```

`check:visual` is the browser review pass — see §16. `check:media-mentions` is the press-queue
probe — see §17. `sweep:quotes` is the quote-post discovery sweep — see §18. `review:profiles`
re-reads profiles already paid for and **makes no network request at all** — see §19.
`refetch:truncated` and `probe:fields` are one-off diagnostics, both already run (§20). None of the
six is part of the pre-deploy pipeline below: the first must not run alongside a build, and two of
the rest make outbound requests to third-party services.

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

**The pattern is wider than the one file B10 converted.** A live-data literal still sits in
`tests/evidence.test.ts`, `tests/media-contract.test.ts` and `tests/public-references.test.ts`
(media counts — B11's path) and in `tests/attention-grid.test.ts`, `tests/archive.test.ts` and
`tests/observations.test.ts` (post counts — B12's path). Each goes red on the first record its
batch adds. Convert them in the batch that moves those records, in the shape above.

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
history (`docs/DATA.md §5`, B18): the enrichment pass leaves them alone entirely. A metric refresh
stays opt-in (`--refresh-metrics`, still unimplemented — B12) and, when it lands, **appends** an
observation carrying its own `observed_at` and `source: "api"` rather than overwriting the
previous reading.

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

**Strictly read-only.** It reads `data/media.json`, fetches each selected record's `url`, and
reports whether the page text contains `layoffhedge` or `@LayoffAI`. It never writes to `data/`.
Promotion stays a human edit, because the tool cannot do the thing that actually matters.

```bash
pnpm check:media-mentions                       # every needs_review record
pnpm check:media-mentions --id media-forbes-…   # one record
pnpm check:media-mentions --limit 10 --delay 1500
pnpm check:media-mentions --no-proxy            # direct requests only
```

**A mention is not a verification, and the tool says so every run.** A hit means the string is on
the page — it could be a sidebar, a related-links rail, an unrelated quote. `docs/WORKPLAN.md`
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

The per-record report is written to the gitignored `.cache/media-mentions.json`, and the
extracted text of every page a run fetched to `.cache/pages/<record-id>.txt` — never into
canonical JSON. The text is kept because the tool's whole claim is that the reading starts from
a fetched page with a located mention: storing only the counts made the reader fetch the same URL
a second time to do the reading the counts exist to enable (added at B14, 2026-09-19).

---

## 18a. Maintenance tool — `pnpm sweep:mentions` (Track A)

`scripts/sweep-mentions.ts`. **Occasional discovery tool. Never production runtime.**

```bash
pnpm sweep:mentions                          # size the window with counts (~$0.01) and stop
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

### `pnpm probe:fields`

`scripts/probe-field-parameter.ts`. Asks one post for the same fields twice, once under
`tweet.fields` and once under `post.fields`, and keeps both raw bodies. It exists as the record of
how the vocabulary question was settled: the API answers in the dialect you ask in — `note_tweet`
versus `note_post` — and both carry the full text. Re-runnable for a few tenths of a cent, free
inside the 24-hour dedup window.

### `pnpm refetch:truncated`

`scripts/refetch-truncated-posts.ts`. **Already executed, 2026-09-21.** Kept as the record of a
measurement, not as a tool anyone needs to run again.

**Read its result as corrected, not as first written.** Its first run concluded that `note_post` is
unpopulated on this tier. That was our bug, not the API's: the request sent `tweet.fields` and the
reader looked for `note_post`, a key that only exists in the `post.fields` dialect. Re-run with the
key read correctly — free, inside the dedup window — it recovered **32,495 characters across 34 of
48 posts**, and **24 of them name the project in prose** where the stored text did not. One
maintainer rejection was reversed as a result.

It re-fetched 48 Track A posts asking for `note_post` — the field the OpenAPI spec says carries the
remainder of a long post — and wrote the result to
`research/x-api-2026-09-20/track-a-full-text.json`.

**It disproved the premise it was built on**, which is why it is worth keeping:

- **`note_post` appeared to return nothing** — 48 posts, 0 characters recovered. Later shown to be
  a dialect mismatch in our own reader, not an API limitation. The corrected lesson: *when a
  documented field comes back empty, suspect your request before blaming the API.*
- **The selection heuristic was wrong.** "Text ending in a bare t.co link" is usually an ordinary
  post with an attached photo, not a stub. The function keeps that heuristic, commented as wrong,
  because changing it would misdescribe which 48 posts were actually bought.
- **What the 48 were:** 28 link `layoffhedge.com` without naming it in prose, matching the Track A
  query through `url:` rather than through the text. Overwhelmingly token promotion — the "bare
  link, no act of its own" shape already archived on sight. No record had been missed.
- **Post reads bill at exactly $0.005.** Balance $1.02 → $0.78 for 48 posts, no user reads. This
  closed an open unknown and retired the blended `$0.0068` planning rate (`docs/X-API.md §1`).
- **The corrected re-run cost $0.0000**, inside the 24-hour dedup window.

Cost $0.2400, authorised in advance, appended to the ledger in
`research/x-api-2026-09-20/cost-ledger.json`.
