# DATA.md

Owns: canonical JSON contract, enums, validation rules, derived metrics.
(Consolidated from `DATA_MODEL.md`, kept in `docs/archive/`.)

Canonical rule:

> **Store the evidence. Derive the number. Show the source.**

Never store a summary value that can be computed (`posts_over_1m`, `total_views`, `top_post`),
neither in JSON, nor in constants, nor in components.

---

## 1. Files

```text
data/posts.json           tracked LayoffHedge / @LayoffAI posts + observed metrics
data/amplifications.json  public people/organizations that amplified the content
data/media.json           external media and public references
data/milestones.json      editorial milestones
data/project.json         project metadata (no metrics)
```

Optional later only if genuinely needed: `people.json`, `organizations.json`, `snapshots/`.

**Current state (2026-09-16):** 20 posts (all `verified`), 9 amplifications (5 `verified`,
4 `needs_review`), media `[]`, milestones `[]`, no placeholders.

---

## 2. Formatting rules

UTF-8 · valid JSON · double quotes · 2-space indent · no comments · no trailing commas ·
`snake_case` fields · ISO dates `YYYY-MM-DD` (full timestamps `2026-09-15T18:30:00Z` only when
time matters) · stable IDs.

Never store formatted values: `"views": 18700000` not `"18.7M"`; `"2026-09-15"` not `"Sep 15, 2026"`.
Formatting belongs to the UI.

Use `null` for unknown/unavailable — never `""`, `"N/A"`, `"unknown"`, or `0`
(`0` only when zero was actually observed).

An optional field may also be **omitted entirely** instead of written as `null`; the loaders
normalize the two to the same thing, so application code only ever sees `value | null`, never
`undefined`. Explicit `null` is preferred for readability in hand-edited records.

### IDs

Format `category-descriptor-date` (or `-tweetid`), lowercase, hyphenated, stable after publication.

```text
post-layoffai-2099180586858393814
amp-harmeet-dhillon-2098925135302476136
media-forbes-layoffhedge-2026-04-11
milestone-first-10m-post-2026-06-02
```

### URLs
Absolute, public, canonical, no tracking parameters. Optional `archive_url` when a source may vanish.

### Country codes
ISO 3166-1 alpha-2 (`US`, `GB`, `IT`). Friendly names are a UI concern.

---

## 3. Status and placeholders

```text
verified      evidence checked; may contribute to public metrics
needs_review  incomplete/disputed/unconfirmed; excluded from headline metrics
archived      kept for history; excluded from normal public metrics
```

Development fixtures must carry `"_placeholder": true` **and** `"status": "needs_review"`.
Production builds must fail if a visible placeholder remains.

Public inclusion rule everywhere: `status === "verified" && _placeholder !== true`.

---

## 4. Shared source fields

```json
{ "source_url": "https://…", "source_label": "Original X post", "verified_at": "2026-09-15" }
```

`source_label` examples: `Original X post`, `Repost by public figure`, `Forbes article`,
`Official LayoffHedge page`.

---

## 5. `posts.json`

```jsonc
{
  "id": "post-layoffai-2099180586858393814",
  "platform": "x",                       // x | website | youtube | linkedin | other
  "account": "@LayoffAI",
  "published_at": "2026-09-13",
  "title": "Amazon layoffs",             // short, neutral, non-sensational
  "subject": "Amazon",                   // nullable
  "summary": null,                       // nullable, 1–2 factual sentences
  "url": "https://x.com/…",
  "status": "verified",
  "featured": false,                     // editorial flag, not a metric
  "tags": [],
  "metrics": {
    "views": 18700000,                   // integer >= 0, required
    "likes": null, "reposts": null, "replies": null, "bookmarks": null,
    "observed_at": "2026-09-15"          // required
  },
  "screenshot": null,                    // optional local path, e.g. /images/posts/…​.webp
  "notes": null,
  "verified_at": "2026-09-15"
}
```

Required: `id, platform, account, published_at, title, url, status, metrics.views, metrics.observed_at`.

**Views are observations.** `views + observed_at` means *the post displayed ~that many public
views when checked on that date* — not unique people, not a final lifetime count, not X analytics.
V1 keeps only the latest observation; an `observations[]` history is a future extension, not V1.

---

## 6. `amplifications.json`

```jsonc
{
  "id": "amp-example-senator-2026-05-18",
  "entity_type": "person",               // person | organization
  "entity_name": "Example Name",
  "role": "U.S. Senator",                // nullable
  "organization": "United States Senate",// nullable
  "category": "politics",
  "action": "repost",
  "date": "2026-05-18",
  "platform": "x",
  "account": "@example",
  "evidence_url": "https://x.com/…",     // required
  "related_post_id": null,               // must exist in posts.json when not null
  "follower_count": null,                // never without follower_count_observed_at
  "follower_count_observed_at": null,
  "country": "US",
  "featured": false,
  "portrait": null,
  "notes": null,
  "status": "verified",
  "verified_at": "2026-09-15"
}
```

Required: `id, entity_type, entity_name, category, action, date, evidence_url, status, verified_at`.

```text
category: government | politics | journalism | media | business | tech | public_figure | other
action:   repost | quote_post | reply | mention | share | citation | interview | other
```

Use the most accurate action — a mention is not a repost, a repost is not an endorsement.
New categories require updating this doc, the schema and the UI filter config together.

Follower counts are contextual metadata only, never evidence of impressions.

---

## 7. `media.json`

```jsonc
{
  "id": "media-example-publication-2026-04-11",
  "publication": "Example Publication",
  "title": "Example article title",
  "reference_type": "article",           // article|newsletter|podcast|broadcast|research|blog|other
  "published_at": "2026-04-11",
  "url": "https://example.com/article",
  "author": null, "country": null,
  "context": "Cites LayoffHedge layoff data.",   // short, factual, never editorializing
  "related_post_id": null,
  "featured": false, "logo": null, "archive_url": null, "notes": null,
  "status": "verified",
  "verified_at": "2026-09-15"
}
```

Required: `id, publication, title, reference_type, published_at, url, status, verified_at`.

One record per article. Publication totals (`FORBES — 3 references`) are **derived**, never stored.

---

## 8. `milestones.json`

```jsonc
{
  "id": "milestone-first-10m-post-2026-06-02",
  "date": "2026-06-02",
  "title": "First tracked post above 10M views",
  "category": "attention",   // attention|crossover|media|politics|project|community|other
  "description": "A tracked @LayoffAI post crossed 10M observed views.",
  "evidence_url": "https://x.com/…",
  "related_post_id": "post-example-2026-06-02",
  "status": "verified",
  "verified_at": "2026-09-15"
}
```

Required: `id, date, title, category, status`. `description`, `evidence_url`, `related_post_id`
and `verified_at` are nullable — a milestone can be derived from records the site already holds,
so it does not always carry its own evidence URL.

Editorial records, not primary metrics.

---

## 9. `project.json`

```json
{
  "project_name": "LayoffHedge Attention Index",
  "short_name": "Attention Index",
  "official_project_url": "https://layoffhedge.com",
  "official_x_account": "@LayoffAI",
  "repository_url": null,
  "data_last_updated": "2026-09-16",
  "methodology_version": "1.0",
  "disclaimer": "Independent community project. Not affiliated with or endorsed by LayoffHedge."
}
```

Labels, links, last update, methodology version, disclaimer. **Never calculated metrics.**
`repository_url: null` must degrade gracefully in the UI (hide/disable GitHub CTAs).
Update `data_last_updated` whenever production data changes.

---

## 10. Derived metrics

Computed from eligible records only (`verified` && not placeholder), as pure functions.

### Attention (`posts.json`)

```text
trackedPostCount      verifiedPosts.length
postsOver1M           views >= 1_000_000
postsOver5M           views >= 5_000_000
postsOver10M          views >= 10_000_000
topPost               highest views → record + views + url + observed_at
totalObservedViews    sum of views   → label "OBSERVED VIEWS ACROSS TRACKED POSTS"
```

Thresholds are inclusive (`>=`). `totalObservedViews` is a sum of post-level counters: it is not
unique people, and the same person may appear in several posts. Methodology must state this.

### Attention Grid cell selection (`src/lib/metrics/attention-grid.ts`)

`selectAttentionGridCells(metrics: AttentionMetrics): AttentionGridCell[]` — a pure function over
`AttentionMetrics`, consumed by `StatGrid` (docs/HOMEPAGE.md §6). Priority order, skipping any
threshold cell whose count is `0`:

```text
1. POSTS ABOVE 1M            (if count > 0)
2. POSTS ABOVE 5M            (if count > 0)
3. POSTS ABOVE 10M           (if count > 0)
4. TRACKED POSTS             (always available)
5. MOST VIEWED TRACKED POST  (always available)
6. OBSERVED VIEWS ACROSS TRACKED POSTS (always available)
```

Returns the first four candidates. Only `MOST VIEWED TRACKED POST` is tied to one specific
record — it is the only cell carrying `sourceUrl` / `sourcePlatformLabel` / `observedAt`; the
count and sum cells derive from many records with different observation dates and carry none of
those fields. If no threshold cell qualifies, fewer than four cells are returned — the function
never fabricates a fourth cell to pad the grid; `StatGrid` renders whatever it receives. With
today's dataset (21 posts, `postsOver1M` 17, max 4.5M, sum 37.1M) this resolves to
`POSTS ABOVE 1M · TRACKED POSTS · MOST VIEWED TRACKED POST · OBSERVED VIEWS ACROSS TRACKED POSTS`.

### Archive selectors (`src/lib/metrics/archive.ts`)

`compareArchiveOrder(a, b)` — the one shared comparator for "the archive order": highest views →
earliest `published_at` → smallest `id` (lexicographic). `getAttentionMetrics`'s `topPost` uses
this exact function for its tie-break (it used to keep a private, duplicate copy — extracted in
B3 so the top-post pick and the archive sort can never silently diverge).

`selectArchivePosts(posts: Post[]): { post: Post; rank: number }[]` — eligible posts (same rule as
above), sorted by `compareArchiveOrder`, each carrying its **stable, 1-based rank** in the full
sorted list. Rank is assigned once, before any threshold filter — filtering a rendered list must
only hide rows, never renumber them, so archive row `01` always means "most viewed tracked post."

`HOMEPAGE_ARCHIVE_ROW_COUNT = 6` — the homepage Viral Archive section (docs/HOMEPAGE.md §10) shows
the first N of `selectArchivePosts`'s result. If the dataset has fewer than N eligible posts, the
section shows what exists rather than padding.

`selectArchiveThresholds(posts: Post[]): { id, label, minViews, count }[]` — the `/archive` filter
set. `ALL` (`minViews: null`) is always included, even for zero eligible posts. Every other
threshold (`>1M`, `>5M`, `>10M`, inclusive `>=`, matching the Attention thresholds above) is
included only when at least one eligible post meets it — a threshold with zero records is never
offered. With today's dataset (max views 4.5M) this resolves to `ALL` and `>1M` only.

### Amplification (`amplifications.json`)

```text
verifiedAmplificationCount · uniqueAmplifiers · countsByCategory
(politics, government, journalism, media, business, tech, public_figure, other)
```

Count unique entities by stable identity; never count one amplification twice.

### Media (`media.json`)

```text
verifiedMediaReferenceCount · uniquePublicationCount · referencesByPublication · referencesByType
```

### Crossover
Descriptive counts and real examples only. **Never invent** Crossover Score, Influence Score,
Attention Quality Score or similar pseudo-precision.

---

## 11. Sorting defaults

```text
archive         views descending (optionally date descending)
amplifications  featured first, then date descending
media           published_at descending
milestones      date ascending
```

---

## 12. Validation requirements

`pnpm validate:data` must check, reporting the exact record and field:

- schema conformance for every file
- unique IDs within each file
- valid ISO dates, valid absolute URLs, allowed enum values
- required fields present
- numeric metrics are non-negative integers
- `related_post_id` references an existing post (fails if dangling)
- `verified` records carry their required evidence:
  - post → `url`, `metrics.views`, `metrics.observed_at`
  - amplification → `evidence_url`
  - media → `url`
- every `verified` record carries `verified_at` (nullable only for `needs_review` / `archived`)
- `follower_count` never present without `follower_count_observed_at`
- placeholder records reported

`pnpm check:production-data` must fail when visible placeholders remain, when a headline metric
would be computed from non-verified records, or when required project metadata is missing.

Implementation: Zod schemas in `src/schemas/` mirroring this document exactly. If code and this
doc diverge, decide the intended behavior and update both — never leave the mismatch.

---

## 13. Contribution and corrections

```text
identify file → add/update record → attach public evidence → normalize values
→ pnpm validate:data → pull request → review → merge → rebuild
```

PRs with unsupported claims are not merged. For material corrections, describe:
`Record / Reason / Old value / New value / Evidence`. Git history is the audit trail.

Invalid records: prefer `status: "archived"` when history matters; delete only when the record
was erroneous, duplicate, never valid, or problematic.

---

## 14. Data entry checklists

**Post** — public URL exists · published date known · views observed directly · observation date
recorded · title short and neutral · status correct · no invented metrics · unique ID.

**Amplification** — identity clear · role accurate · action correctly categorized · public evidence
exists · date known · category normalized · related post linked when known · unique ID.

**Media** — publication identified · title accurate · public URL exists · date known · reference
genuinely concerns LayoffHedge/@LayoffAI · context factual · unique ID.

---

## 15. Future compatibility

Record shapes are designed so a future ingestion pipeline writes the same contract:
`manual JSON → validated JSON → automated ingestion`, never a rewrite.

> If a number cannot be traced back to a record and a source, it must not appear as a headline metric.
