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
data/project.json         project metadata (no metrics)
```

Optional later only if genuinely needed: `people.json`, `organizations.json`, `snapshots/`.

**Current state (2026-09-20, after B10):** 32 posts (all `verified`), 15 amplifications (all
`verified` — five added by B10's search sweep, which opened the `media` category at three records),
103 media references (94 `verified`, 9 `archived`, **no `needs_review` left** — the
imported press queue has been worked through end to end). Of the 94 verified media records: 77
original, 17 republications, 33 featured, newsrooms in 7 countries (56 of the 77 originals carry
a country; the rest are deliberately blank). A dated reading of the dataset, not a target —
derive, never match.

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
  "observations": [                      // append-only, oldest first, at least one
    {
      "views": 18700000,                 // integer >= 0, required
      "likes": null, "reposts": null, "replies": null, "bookmarks": null,
      "observed_at": "2026-09-15",       // required, unique within the post
      "source": "interface"              // api | interface, required
    }
  ],
  "screenshot": null,                    // optional local path, e.g. /images/posts/…​.webp
  "notes": null,
  "verified_at": "2026-09-15"
}
```

Required: `id, platform, account, published_at, title, url, status`, and at least one observation
carrying `views`, `observed_at` and `source`.

**Views are observations.** `views + observed_at` means *the post displayed ~that many public
views when checked on that date* — not unique people, not a final lifetime count, not X analytics.

### The observation history (B18)

**A refresh appends; it never replaces.** A reading of a public counter cannot be re-taken, so
discarding it throws away the only record that the number was ever that on that day. The array is
stored oldest first and validation enforces that.

**The public figure is the latest observation** — the one with the greatest `observed_at`, via
`latestObservation` (`src/lib/metrics/observation.ts`). Every derived metric reads exactly one
observation per post through that function, which is what keeps the headline numbers meaning what
they meant before the history existed: a sum of one agreed reading each, never a mix of readings
from different days of the same post, and never a sum of a post's whole history.

`observed_at` is **unique within a post**, which is what makes "the latest" a single well-defined
record rather than a tie to break. Two readings on one day are the one case where a reading is
genuinely redundant — same day, same counter, differing only in how it was read. If both must be
kept, `§2` already allows a full timestamp, and that separates them.

**`source` — and why there is no `precision` field.** A platform API returns exact integers; a
public interface rounds above 1,000 (X prints `427K` for 427,443). Precision therefore *follows
from* the source, and storing it separately would be a derivable value, which the canonical rule
bans. It sits on each observation, not on the post, because one post can legitimately hold both
kinds: seeded by hand before the API could return it, refreshed from the API afterwards.

**What must never happen is a series drawn across mixed sources.** A single figure is always
honest, because it is paired with its own date — "427K observed on Sep 19 2026" stays true even
though an API reading two days earlier said 427,443. That 443-view difference is a rounding
artefact, not a decline, and it only becomes a lie if someone plots the two points as a trend.
`source` exists on every observation so a future consumer can filter for one kind. The selector
deliberately does **not** prefer the API reading: doing so would publish a figure that is not the
most recent one, on a judgement this project has no basis for making.

**Process rule for refreshes.** An automated refresh always appends a reading with
`source: "api"`, because that is where it reads from. An `interface` reading is only used to seed
a post the API cannot return. Followed, the series stays homogeneous and the mixed-source hazard
never arises in practice.

**The 2026-09-19 backfill.** The 32 existing posts were migrated to a one-element history with
`source` classified mechanically: a value that is exactly what X's interface would print is
`interface`, anything else is `api`. Below 1,000 the interface prints exactly; from 1,000 it
prints at most one decimal of `K` (a multiple of 100) and from 1,000,000 at most one decimal of
`M` (a multiple of 100,000). That gives **31 `interface` and 1 `api`** — `427443` on
`post-layoffai-2086800985079562516` — which matches the recorded history of those readings. The
rule's known blind spot: an API reading that happens to land on a round number would be
classified `interface`. It is stated here so a later correction is a one-line edit rather than an
archaeology problem.

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

### Choosing `category` — the full mapping

**The governing rule (maintainer decision, 2026-09-21):** *the category follows the role the
person or organisation holds **at the time of the act**, not the highest office they ever held.*

It was settled when a third former-officeholder record arrived and the first two had been
categorised differently. It reproduces both of those unchanged, and it is the tie-breaker whenever
a record could sit in two categories.

| Category | Who it holds | Test at the time of the act | Records today |
|---|---|---|---|
| `government` | officials and official bodies acting in an administrative or enforcement capacity | holds an appointed or civil-service position, or is an agency account | 2 — an Assistant Attorney General, a federal Inspector General |
| `politics` | elected officeholders, and people whose current public role is political | holds elected office, seeks it, or acts publicly as a political figure or commentator | 8 — five members of Congress, a sitting governor, a former member now commentating for a news network, a network commentator |
| `journalism` | **individual** reporters, editors, correspondents, columnists | that is their job when they act | 1 — a named outlet's columnist, confirmed against that outlet's own author page |
| `media` | news **organisations** posting as themselves | the account is the outlet, not a person | 4 |
| `business` | companies and executives outside technology | acting in that commercial role | **0** |
| `tech` | technology companies and their executives | acting in that role | 1 |
| `public_figure` | notable people whose current public role fits none of the above | notable, but not currently political, journalistic, media, business or tech | 4 |
| `other` | anything genuinely outside the seven | — | 0 |

**`government` vs `politics`** is the line that needs stating, because both are public office. The
dataset draws it on *how the office is held*: `politics` is for people who stand for election —
legislators, governors, candidates — and `government` is for appointed officials and institutional
accounts acting administratively. A sitting governor is `politics`; a Department's Inspector
General is `government`.

**`media` vs `journalism`** is organisation versus individual. An outlet's own X post is an
amplification carrying `category: media`; a reporter posting under their own name is `journalism`.
Note that an outlet's *published article* is not an amplification at all — it belongs in
`media.json` (§7). The same outlet can therefore appear in both files for different acts.

**Worked examples, the three that set the rule:**

```text
Chaffetz   former U.S. Representative, now a news-network commentator  -> politics
Carson     former U.S. Representative, now runs a policy organisation  -> public_figure
Evans      former state legislator, now in business and farming        -> public_figure
```

All three carry the office in the `role` string regardless, so nothing is lost by the category: a
reader sees "Former member of the West Virginia House of Delegates" either way.

**~~`journalism` and `business` stand at zero~~ — `journalism` opened on 2026-09-21, and the
reasoning under it was wrong.**

`business` still stands at zero, and the part that holds is the first half: `selectCrossoverCategories`
omits any category with no records (§10), so an empty category is invisible to a reader and costs
nothing. It is kept because removing a category from the enum is a schema change that would have to
be reversed the moment a non-tech executive appears.

**The part that was wrong:** this said journalists "cite in prose, which is the full-archive search
population, never the quote-post population — so no quote-post sweep can fill `journalism` however
many posts it covers." A quote-post sweep filled it. Track B's calibration run surfaced
`@kylenabecker`, a RedState columnist confirmed against RedState's own author page, **quote-posting**
a tracked post with an argument of his own — `amp-kyle-becker-2087712833760813122`.

The mistaken step was treating "how an outlet cites" as "how a journalist amplifies". An outlet
publishes prose that names a source, and that is indeed Track A's population. An individual
journalist with an X account behaves like any other commentator: he quote-posts. So the two
populations are not split by *who* the account is, they are split by **which surface the act happens
on**, and a person can use either.

**What follows for discovery spend:** a sweep aimed at filling a category is still the wrong frame —
categories are an outcome of what is found, never a target (`CLAUDE.md §3`). But "this track cannot
reach that population" is a claim about mechanics, and this one did not survive contact.

Follower counts are contextual metadata only, never evidence of impressions.

---

## 7. `media.json`

```jsonc
{
  "id": "media-example-publication-2026-04-11",
  "publication": "Example Publication",  // the outlet's standard public form, nothing else
  "title": "Example article title",
  "reference_type": "article",           // article|newsletter|podcast|broadcast|research|blog|other
  "published_at": "2026-04-11",
  "url": "https://example.com/article",
  "author": null,
  "country": null,                       // ISO-2 of the publication's own newsroom
  "provenance": "original",              // original | syndicated | null (= not determined yet)
  "syndicated_from": null,               // the outlet this piece credits; required iff syndicated
  "cited_work": "h1b_data",              // layoff_data | h1b_data | investigation | none | null
  "context": "Cites LayoffHedge layoff data.",   // short, factual, never editorializing
  "related_post_id": null,
  "featured": false, "logo": null, "archive_url": null, "notes": null,
  "status": "verified",
  "verified_at": "2026-09-15"
}
```

Required: `id, publication, title, reference_type, published_at, url, status, verified_at`,
plus `provenance` and `cited_work` on every `verified` record.

One record per article. Publication totals (`FORBES — 3 references`) are **derived**, never stored.

### The B13 record contract

Three fields decide what a media record contributes to the derived figures. All three were
defined in `docs/WORKPLAN.md` B13, before the verification sweep, so no record is visited twice.
A fourth, `cited_work`, was added at B16 and is specified under it below.

**`country`** — ISO 3166-1 alpha-2 for the country of **the publication's own newsroom**, never
the country the story is about. `null` when it is not settled by a public, citable statement; a
`null` is counted in no country, and is never filled with the likeliest answer.

**`provenance`** — a fact about the piece, never a quality judgement: `"syndicated"` means the
piece itself credits another outlet as the source of the reporting it carries, `"original"` means
it does not. `null` means "not determined yet" and is allowed only while a record is
`needs_review` or `archived` — determining it is part of reading the article. `syndicated_from`
names the credited outlet, is required exactly when `provenance` is `"syndicated"`, forbidden
otherwise, and must name a publication other than this record's own. It is a **name**, not a
record id: the crediting is a fact about the article whether or not the original piece happens to
be in this dataset.

The `publication` field never carries provenance. `layoffhedge.com/press` labels republications
as `Inkl (via IBTimes UK)`; the importer splits that suffix
(`src/lib/validation/publication-name.ts`) so the name stays the outlet's standard public form
(`docs/EDITORIAL.md §5`) and the second fact lands in `provenance` / `syndicated_from`.

**`featured`** — declared curation over media records, published as a written criterion on
`/methodology`, which owns its reader-facing wording. A reference is featured when the publication
produced the piece itself **and** names LayoffHedge or @LayoffAI in its own text (or, for a
broadcast, on air) as the source of data or findings it reports — not only embedding or linking a
post alongside its own reporting. The schema enforces both halves: only a `verified` record with
`provenance: "original"` may be `featured`. It is binary, there is no tier or score, and the flag's
only effect is ordering (`§11`). Where a record's stored evidence does not already establish the
criterion, `featured` stays `false` — `false` is the conservative default and is never a judgement
about the publication.

### `cited_work` (B16)

Which of the official project's works the piece used. The governing rule, and the reason the
field is admissible at all: **the work is never the subject of a record, only an attribute of a
record that already exists** (`docs/WORKPLAN.md` B16). Nothing in this dataset describes a work,
rates one, or exists because of one.

`media.json` only. An amplification is a quote post, not a use of a work, and putting the field on
those records would manufacture attributions for them.

A **closed enum**, because free text does not aggregate:

| value | means |
|---|---|
| `layoff_data` | the layoff dataset and its `layoffhedge.com` surfaces — company and industry pages, monthly and year-to-date totals, headcount estimates attributed to the site |
| `h1b_data` | the H-1B / LCA / USCIS visa data and the surfaces built on it — the congressional district map, the ZIP-code lookup, employer rankings, renewal-approval analyses |
| `investigation` | an original investigation the project published |
| `none` | the piece used no named work: what the record shows is an @LayoffAI post, a quotation, or the project named as a source, and nothing further |
| `null` | not determined yet |

The members are the works **these records give evidence of**, not a catalogue of what the project
ships. A work no verified reference has cited has no member, and adding one is a deliberate edit
to this table and to `src/schemas/media.schema.ts` — never a value invented inside a record. That
standing maintenance cost was accepted when the field was.

**`none` is a determination, not a blank**, and it is the conservative default in exactly the
sense `featured: false` is: it says the record does not show the piece using a named work. It is
therefore an enum member and not `null`. `null` keeps the meaning it has on `provenance` and
`verified_at` — *not determined yet* — and is allowed only while a record is `needs_review` or
`archived`; the schema refuses a `verified` record without a value.

**The rule for choosing one.** A record names a work only where its own stored evidence shows the
piece using it: the article names or links a dataset or one of the surfaces built on it, or names
an investigation. Where a piece names a work **and** embeds a post, the work wins — the post is
the delivery, the work is what was used. An outlet calling the project "a layoff tracker" is
naming the project, not a work; a figure quoted from inside an embedded post is the post's
content, not a use of the dataset behind it. Where the evidence does not reach a work, the value
is `none` rather than the likeliest work.

The field is filled on `verified` records only, for the same reason `country` was at B13:
`needs_review` and `archived` records feed no metric, and determining it belongs to the pass that
reads the article.

---

## 8. *(section retired)*

A fourth record type was removed on 2026-09-19 (`docs/WORKPLAN.md` B17) and its section with it.
The number stays reserved and empty so every `docs/DATA.md §N` reference in the code and the other
docs keeps resolving — do not renumber the sections below it.

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
  "methodology_version": "1.1",
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

Every `views` above is **one observation per post** — the latest, resolved by
`latestObservation(post)` (`src/lib/metrics/observation.ts`, B18). Never a post's whole history,
and never two different readings of one post inside a single figure. `compareArchiveOrder` reads
the same value, so the archive's rank, the top post and the sum can never disagree about what a
post's view count is.

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
never fabricates a fourth cell to pad the grid; `StatGrid` renders whatever it receives. Read
2026-09-20 (32 posts, `postsOver1M` 17, max 4.5M, sum 43,625,943) this resolves to
`POSTS ABOVE 1M · TRACKED POSTS · MOST VIEWED TRACKED POST · OBSERVED VIEWS ACROSS TRACKED POSTS`
— a dated reading, never a target to match. The post count and the sum were stale here (21 and
37.1M, the figures from before the eleven posts landed); corrected at B10.

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

### Amplifier and Crossover selectors (`src/lib/metrics/amplification.ts`)

`AMPLIFICATION_CATEGORY_LABELS` / `AMPLIFICATION_ACTION_LABELS` — the fixed, neutral labels from
docs/EDITORIAL.md §5 and §9, each typed `Record<Enum, string>` (not a partial map) so a future
enum addition that omits its label fails to compile instead of rendering a raw key.

`compareAmplifierOrder(a, b)` — docs/DATA.md §11's amplification order: featured first, then date
descending, with a deterministic tie-break on smallest `id` (lexicographic) — the same reasoning
as `compareArchiveOrder` in `src/lib/metrics/archive.ts`.

`selectAmplifiers(amplifications: Amplification[]): Amplification[]` — the verified, sorted
amplifier list the Amplified By grid (docs/HOMEPAGE.md §9) renders directly. No filters, no
pagination.

`selectCrossoverCategories(amplifications: Amplification[]): { category, label, count, examples }[]`
— Crossover categories (docs/HOMEPAGE.md §8) that have at least one verified record, in the
schema's fixed enum order (`government, politics, journalism, media, business, tech, public_figure,
other`) so node position in `CrossoverMap` is a pure function of this array's order, never
hand-positioned. Categories with a count of `0` are omitted entirely. `examples` holds up to 3 real
entity names per category, in `compareAmplifierOrder`. Read 2026-09-20 (15 verified amplifications)
this resolves to `GOVERNMENT 2 · POLITICS 7 · MEDIA 3 · TECH 1 · PUBLIC FIGURES 2`; `JOURNALISM`,
`BUSINESS` and `OTHER` are absent (zero records) — a dated reading, never a target to match.
`MEDIA` was itself at zero until B10's search sweep found three outlets citing the project on X,
which is what the batch existed to do.

### Media (`media.json`)

```text
verifiedMediaReferenceCount · uniquePublicationCount · referencesByPublication · referencesByType
originalReferenceCount · syndicatedReferenceCount · featuredReferenceCount
referencesByCountry · countryCount · originalReferencesByCitedWork
```

**The counting rule (B13).** Two questions are kept apart instead of averaged into one number,
and neither figure is ever given the other's label:

```text
how many public records are there    verifiedMediaReferenceCount · uniquePublicationCount
                                     referencesByPublication · referencesByType
                                     -> every eligible record, republications included

how much reporting is there          originalReferenceCount · referencesByCountry · countryCount
                                     originalReferencesByCitedWork
                                     -> provenance === "original" only
```

A republication is a real page a real outlet published, so it stays a record, stays visible on
`/evidence` and stays inside its own publication's row — dropping it would make a row's printed
count disagree with the entries under it. But it is the same piece travelling, not a second
newsroom reading the data, so it feeds no figure presented as coverage: one article plus eight
republications of it is one piece of reporting, and adding them would overstate the coverage by
eight. `originalReferenceCount + syndicatedReferenceCount === verifiedMediaReferenceCount`
always, because the schema requires a provenance on every verified record.

`referencesByCountry` counts original records with a non-null `country`; a record whose newsroom
country is unknown is counted in no country. `countryCount` is that map's size — the figure
behind "references from newsrooms in N countries". `featuredReferenceCount` counts eligible
records carrying the `/methodology` criterion.

`originalReferencesByCitedWork` (B16) splits `originalReferenceCount` by `cited_work` (`§7`),
over originals for the same reason `referencesByCountry` is: a republication carries the answer of
the piece it copies, so counting it too would report one newsroom's use of a dataset as two. Every
enum member is a key, `none` included, so the keys sum to `originalReferenceCount` exactly and the
map can never be read as a count of references that cite *something*. The name carries the rule
because it is the only map in that object that does not count every eligible record.

`/methodology` states every one of these in the reader's words and prints today's values live.
None of them is on the homepage: `docs/HOMEPAGE.md §11` keeps the Public References section
without a dominant number, and that standing decision was not reopened in B13.

### Media selectors (`src/lib/metrics/media.ts`)

`compareMediaOrder(a, b)` — media ordering for `/evidence` (B5): newest `published_at` first, tie-
broken by smallest `id` (lexicographic) — the same reasoning as `compareArchiveOrder` and
`compareAmplifierOrder`.

`selectMediaReferences(mediaReferences: MediaReference[]): MediaReference[]` — the verified,
sorted media list `/evidence`'s media section renders directly. No filters, no pagination. With
today's dataset (103 raw records, 94 verified) this resolves to 94 rows. Provenance does not
filter this list: `/evidence` is the ledger where every verified record is auditable, and a
republication is dropped from the derived coverage figures, never from the page that claims to
list everything.

`selectPublicationReferences(mediaReferences: MediaReference[]): PublicationReferences[]` — the
Public References groups (`docs/HOMEPAGE.md §11`), each carrying its own `references`,
`originalCount` and `featuredCount`. Group order is five factual keys, never a computed rank
(`§11`). Read 2026-09-20: 51 groups over 94 references, `IBTimes UK` 17 · `Inkl` 8 ·
`The American Bazaar` 7 · `BeInCrypto` 4 · `The Deep Dive` 4, then a tail in which **40 of the 51
groups hold exactly one reference** — a dated reading, never a target to match.

`HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT = 12` — the homepage Public References section
(`docs/HOMEPAGE.md §11`) shows the first N of that result; `/evidence` lists every verified record
and the section's `OPEN EVIDENCE →` link is how the rest is reached. The counterpart of
`HOMEPAGE_ARCHIVE_ROW_COUNT` above, and the same contract: a dataset smaller than N shows what
exists rather than padding. Twelve is the composition the section was reviewed at in B8 and B13 —
B14 grew the list behind it from 12 groups to 51, which is an argument for capping the section,
not for resizing it. It is deliberately a constant and not a threshold ("every group with more
than one reference" is eleven today and a different number next import).

`mediaReferenceDescriptors(reference)` (`src/lib/format/media-descriptors.ts`) — the B13
attributes as words, for the metadata line shared by the Public References panel and the
`/evidence` media rows: the newsroom country (`src/lib/format/country.ts` resolves the ISO code
to a name, falling back to the code rather than inventing one), `Republished from <outlet>` for a
syndicated record, and `Names LayoffHedge as a source` for a featured one. A featured record
prints its **criterion**, not the word "featured": there is no star, badge or icon anywhere in
this system.

### Crossover
Descriptive counts and real examples only. **Never invent** Crossover Score, Influence Score,
Attention Quality Score or similar pseudo-precision.

### Dataset summary selector (`src/lib/metrics/dataset.ts`)

`selectDatasetSummary(input: { posts, amplifications, mediaReferences }):
DatasetSummaryRow[]` — the three-row summary the homepage Evidence section (docs/HOMEPAGE.md §12)
and `EvidenceBlock` render directly. Each row is `{ key, label, count, href }`:

```text
posts           POST DATA
amplifications  AMPLIFICATIONS
media           MEDIA
```

`count` reuses the shared `isVerifiedRecord` rule against the record set passed in — never
`array.length`, never a stored summary. Row order is fixed (posts, amplifications, media)
regardless of which datasets have records. A zero-count row still renders — it is an honest
statement about the dataset — but its `href` is `null` instead of `/evidence#<key>`, so
`EvidenceBlock` never links to an `/evidence` anchor with nothing under it. This document owns the
sample values; `docs/HOMEPAGE.md §12` draws the section's shape and deliberately prints no counter
of its own, so the two cannot drift apart again. Read 2026-09-20:
`POST DATA 32 · AMPLIFICATIONS 15 · MEDIA 94` — a dated reading, never a target to match.

---

## 11. Sorting defaults

```text
archive         views descending (optionally date descending)
amplifications  featured first, then date descending
media           published_at descending
```

`media` stays chronological wherever the whole list is shown (`/evidence`): that page is a
ledger, and a list whose dates do not run in order reads as broken.

**Public References groups** (`docs/HOMEPAGE.md §11`) are ordered separately, because that is
where prominence belongs. Five keys, every one a fact stored on the records:

```text
1  total reference count, descending         the number the row prints
2  original reference count, descending      provenance carried as position
3  featured reference count, descending      the declared criterion, its only effect
4  most recent published_at, descending
5  publication name, ascending               final deterministic tie-break
```

**The printed number first (B19, revising B13's order).** The rule has not changed: a key the
reader cannot see must never reorder a number the reader can. B13 applied it to `featured`, which
is why featured sits below the counts; B19 applies the same rule one key higher, because the
original count is exactly as invisible on the row as `featured` is. At twelve rows the difference
was undetectable; at fifty-one it put `Inkl` (8 references, 0 originals) at row 43 below thirty-odd
rows printing `1 reference`, and `Alex Jones Live` (3 references) below `The National Pulse` (2) in
the first screenful at 390px. Both were the keys working as designed and both read as a broken
sort — which is what makes it a display decision rather than a data one.

Never a computed rank of any kind, and the ordering still does the prominence work B13 asked of
it, inside the ties the printed number creates: among publications printing the same count, one
that did its own reporting leads one that only republished, and a featured publication leads the
unfeatured ones it ties with.

---

## 12. Validation requirements

`pnpm validate:data` must check, reporting the exact record and field:

- schema conformance for every file
- unique IDs within each file
- valid ISO dates, valid absolute URLs, allowed enum values
- required fields present
- numeric metrics are non-negative integers
- `related_post_id` references an existing post (fails if dangling)
- every post carries at least one observation, stored oldest first, each with `views`,
  `observed_at` and `source`, and no two observations of one post share an `observed_at`
- `verified` records carry their required evidence:
  - post → `url`, at least one observation with `views` and `observed_at`
  - amplification → `evidence_url`
  - media → `url`
- every `verified` record carries `verified_at` (nullable only for `needs_review` / `archived`)
- every `verified` media record carries a `provenance` (nullable only for `needs_review` /
  `archived`)
- every `verified` media record carries a `cited_work` (`"none"` when the piece used no named
  work; nullable only for `needs_review` / `archived`)
- `syndicated_from` is present exactly when `provenance` is `"syndicated"`, and never names the
  record's own `publication`
- `featured` media records are `verified` and `provenance: "original"` (`§7`)
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
recorded · `source` set to how the reading was actually taken · the reading **appended** to
`observations`, never written over the previous one · title short and neutral · status correct ·
no invented metrics · unique ID.

**Amplification** — identity clear · role accurate · action correctly categorized · public evidence
exists · date known · category normalized · related post linked when known · unique ID.

**Media** — publication identified, under its standard public form · title accurate · public URL
exists · date known · reference genuinely concerns LayoffHedge/@LayoffAI · context factual ·
newsroom `country` filled or deliberately left `null` · `provenance` determined, with
`syndicated_from` naming the credited outlet when it is a republication · `cited_work` determined
from the article, `none` where it names no work rather than the likeliest one · `featured` set only
where the article itself meets the `/methodology` criterion · unique ID.

---

## 15. Future compatibility

Record shapes are designed so a future ingestion pipeline writes the same contract:
`manual JSON → validated JSON → automated ingestion`, never a rewrite.

> If a number cannot be traced back to a record and a source, it must not appear as a headline metric.
