# TOOLS.md

The manual maintenance tools that keep this project's data current: taking a new reading of
tracked posts, discovering new coverage, and reviewing what was already paid for. None of them
runs in a build, in CI, or on a schedule — a person runs each one by hand and reads its output.
`docs/USING.md §5` has the one-table overview for a stranger; this document is the full manual,
tool by tool, for whoever runs them.

**Independent community project. Not affiliated with or endorsed by LayoffHedge.**

---

## 1. Principles every tool follows

- No tool runs in `next build`, in CI, or on a schedule. A person runs each one by hand and reads
  its output before anything downstream changes.
- The default mode plans or prints and spends nothing. Spending is an explicit flag (`--sweep`,
  `--fetch`), so a mistyped flag costs nothing. One exception, older than the rule: `sweep:quotes`
  makes one billed request by default (§8).
- Every tool that can bill an amount not otherwise bounded carries its own ceiling that no flag can
  raise — `sweep:web`'s 60 queries per run against a vendor with no default spending cap
  (`docs/PROVIDERS.md §3`) is the sharpest example.
- Meter before and after a billed run: against the vendor's own balance endpoint where one exists
  (`GET /2/usage/credits` for X, `GET /account` for Serper), or against a hand-kept ledger where it
  does not (Brave — `docs/PROVIDERS.md §3`).
- One ledger line per billed request, written as the request happens rather than reconstructed
  afterwards, so a run that aborts halfway still records what it spent getting there
  (`src/lib/sweep/cost-ledger.ts`).
- Every billed response is written to `research/` before it is parsed. A request that was
  misunderstood and a field that is genuinely absent read identically once the response is gone —
  archiving first is what makes the difference recoverable (`src/lib/sweep/raw-archive.ts`). The
  endpoint is stored as a path, never the full URL: a query string can carry credentials, and no
  credential is ever written anywhere, including into the archive.
- `research/` holds paid, once-bought material and is not a cache: it is gitignored but not
  disposable, because some of what lands there cannot be re-bought at the same price — a follower
  count, a profile bio, a page of enumerated quote-posters. Everything transient goes to `.cache/`
  instead. See `research/README.md`.
- Request hygiene: every field name a script sends is checked against the vendor's own spec by
  `tests/api-field-validity.test.ts`, which CI runs against a freshly downloaded copy of that spec.
  The raw response body is always kept beside anything derived from it. A paginated run asserts on
  page one that the fields it depends on actually arrived, rather than paging on regardless and
  billing for a run that reports nothing.
- Verification is a stage of each discovery track, not an afterthought. Both `sweep:mentions` and
  `sweep:quotes` emit, per candidate, the claim a human must confirm and where —
  `verificationClaims()` in `src/lib/sweep/quote-candidates.ts`, shared so a rule fixed in one track
  is fixed in both. No candidate is ever auto-promoted; a person reads the source and writes the
  record.
- Credentials live in `.env.local` only, are read by nothing but the script that needs them, and
  are never committed, logged, placed in JSON, or exposed to the browser.

---

## 2. The manual refresh routine

Everything the site shows can be brought up to date by hand, in this order. Each step is optional
and independent — run the ones that are due.

```bash
# 1. Post metrics — the headline numbers. ~$0.16, X API.
pnpm refresh:metrics -- --fetch
pnpm refresh:metrics -- --from tracked-post-metrics-<day>.json --write

# 2. New coverage — discovery only; nothing becomes verified until a person has read the source.
pnpm sweep:web -- --sweep --since-last --fetch                       # Brave, card, <= $0.065
pnpm sweep:web -- --vendor serper-news --sweep --since-last --fetch  # Google News, free credits
pnpm import:press                                                    # official press page, free; adds needs_review records
pnpm sweep:mentions                                                  # X mentions since the last run: sizes it, $0.01 per 31 days
pnpm sweep:mentions -- --sweep                                       # ...and fetches it, paid per post

# 3. Before committing any change to data/.
pnpm validate:data && pnpm check:production-data && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

**`sweep:mentions` after a long gap.** It resumes from the `since_id` in
`research/track-a-state.json`. What window the API applies to a `since_id` given with no
`start_time` is not documented, and a run cannot find out without paying. So when more than 30 days
have passed since that file's `covered_through`, pass the date explicitly:
`pnpm sweep:mentions -- --start-time <covered_through>T00:00:00Z`, sizing first and then with
`--sweep`. The sizing follows every 31-day page, so its price is for the whole window.

After step 3, there is nothing left to hand-edit for figures: `docs/DATA.md`, `docs/HOMEPAGE.md`
and `docs/PRODUCT.md` hold no live counts of the current dataset any more — every number that
remains in them is either a dated historical reading, explicitly marked as never a target to
match, or an illustrative example. The tests need no edit either: every test over `data/` asserts
relationships, and the literals live in the frozen fixture (`docs/ENGINEERING.md §9`). A metric
refresh changes numbers, not layout; whether a change warrants a visual pass (`check:visual`, §11)
is the maintainer's call. There is no date field to update by hand anywhere in this routine — the
footer, `/methodology` and the sitemap all read a date derived from the refreshed data itself
(`dataLastUpdated`, `docs/DATA.md §10`).

---

## 3. `pnpm refresh:metrics`

**What it is for.** Buys a new reading of every tracked post's public counters and appends one
observation per post to its history. It is the only maintenance tool that writes to `data/`, and
the one judgement it makes — which counter maps to which field — is made once, in tested code,
never by hand.

**Commands.**
```bash
pnpm refresh:metrics                                    # plan: no request, no write
pnpm refresh:metrics -- --fetch                         # buy one reading — ~$0.16 for 32 posts
pnpm refresh:metrics -- --from <file>                    # show a reading already paid for, free
pnpm refresh:metrics -- --from <file> --write            # append it to data/posts.json
```

**Cost.** One `GET /2/tweets?ids=` request per 100 tracked posts; $0.005 per post returned
(`docs/PROVIDERS.md §2`).

**Reads and writes.** Reads `data/posts.json` for the tracked ids. `--fetch` archives the raw
response under `research/x-api-<day>/raw/` and saves the parsed reading to `research/post-metrics/`.
`--write` is the only mode that touches `data/posts.json`: it backs the file up to
`.cache/backups/` first, validates the result against the schema, and preserves the file's
formatting and line endings, so the diff is only the appended lines.

**Credentials.** `X_BEARER_TOKEN`, read only when `--fetch` is used.

**Known traps.**
- A post that already holds a reading on or after the fetched date is skipped, with the reason
  printed — re-applying the same reading changes nothing.
- `--fetch` alone writes nothing; only `--write` touches `data/`.
- `sweep:quotes --measure` (§8) saves its reading to the same folder in the same shape, so a
  reading bought by either tool can be applied here with `--from`.

**Measured.** 2026-09-21: 32 posts read for $0.16 (~$0.005/post).

---

## 4. `pnpm enrich:twitter`

**What it is for.** Fills post metadata (title, subject, summary, tags) and amplification metadata
(action, related post, entity, account, date) by fetching the public tweet text behind each URL
already in `data/`. It never touches a stored observation: those live in `post.observations`
(`docs/DATA.md §5`) and refreshing them is `pnpm refresh:metrics` (§3), a separate tool. The
`--refresh-metrics` flag this script once declared was never implemented; it now stops before any
request and points there.

**Commands.**
```bash
pnpm enrich:twitter                       # plan: eligible ids, request count, modelled cost — no request
pnpm enrich:twitter -- --dry-run          # no --fetch: same plan as above
pnpm enrich:twitter -- --fetch            # buy the lookup, report, write data/ (with backups)
pnpm enrich:twitter -- --fetch --dry-run  # buy the lookup, report, write nothing
```

**Cost.** Free to plan. `--fetch` bills per post returned (`docs/PROVIDERS.md §2`) plus, on top of
that, one user read per *distinct author* the `expansions=author_id` request returns — never per
post. The plan prints the post-read cost as a certain floor and the author-read cost as an upper
bound of one per id, via `src/lib/metrics/enrichment-plan.ts`.

**Reads and writes.** Reads `data/posts.json` and the evidence URLs in `data/amplifications.json`.
`--fetch` archives each batch's raw response under `research/x-api-<day>/raw/` before parsing it
(`src/lib/sweep/raw-archive.ts`, §1). Outside `--fetch --dry-run`, backs both files up to
`.cache/backups/<timestamp>/` and writes the normalized fields back to `data/posts.json` and
`data/amplifications.json`.

**Credentials.** `X_BEARER_TOKEN`, read only when `--fetch` is used.

**Known traps.**
- Never invents content: a tweet that cannot be fetched, is deleted, or is ambiguous is flagged and
  left `needs_review` rather than guessed.
- Never infers `quote_post` / `repost` / `reply` / `mention` when the API response does not support
  the classification.
- Reports per record (tweet ID, fetch status, old/new title, subject, `published_at`, notes) but
  does not validate for you — run `validate:data`, `typecheck` and `test`, and review the diff,
  before committing.

---

## 5. `pnpm import:press`

**What it is for.** One-time / occasional seed of `data/media.json` from
`https://layoffhedge.com/press`, the official press page. It is plain server-rendered HTML parsed
with targeted regex — regular enough that a scraping framework was never installed (dependency
gate, `docs/ENGINEERING.md §1`).

**Commands.**
```bash
pnpm import:press
```

**Cost.** Free — a plain page fetch, no paid API involved.

**Reads and writes.** Fetches the live press page over HTTP. Writes new records to
`data/media.json`, deduplicated by canonical article URL, every new import marked
`status: "needs_review"`. Existing manually reviewed records are preserved untouched.

**Credentials.** None.

**Known traps.**
- Nothing is auto-verified: it reports counts (discovered / added / duplicates skipped / missing
  article URLs / needing review / publication counts); run `pnpm validate:data`, then promote sound
  records to `verified` by hand.
- Extracts publication, title, author, published date, article URL and short factual context only
  where the page provides them — missing fields are left for review, not guessed.

---

## 6. `pnpm check:media-mentions`

**What it is for.** Fetches a page — one already in `data/media.json`, or any URL supplied — and
reports whether the page's own text names this project, with the sentence around each hit.
Strictly read-only: it never writes to `data/`; promotion is always a human edit, because reading a
fetched page with a located mention is exactly what the tool cannot do on its own.

**Commands.**
```bash
pnpm check:media-mentions                              # every needs_review record
pnpm check:media-mentions -- --id media-forbes-…       # one record
pnpm check:media-mentions -- --urls <file>             # a plain list of URLs in no file yet
pnpm check:media-mentions -- --status needs_review      # filter by status (default needs_review)
pnpm check:media-mentions -- --limit 10 --delay 1500
pnpm check:media-mentions -- --no-proxy                # direct requests only
```

**Cost.** Free — publisher pages, not a paid API.

**Reads and writes.** `--urls <file>` reads one URL per line (`#` comments and blank lines ignored,
anything after the URL taken as a label) — exactly the format `sweep:web` (§10) writes with
`--fetch`, so the handoff between the two tools is a paste, not a transcription. Writes the
per-target report to the gitignored `.cache/media-mentions.json` and the extracted text of every
fetched page to `.cache/pages/<target-id>.txt`. Never touches canonical JSON.

**Credentials.** None.

**Known traps.**
- A hit means a form of the name is on the page — sidebar, related-links rail, unrelated quote. It
  is a reason to read the page, never a verification.
- Two request paths with different headers: a direct request first, falling back through
  `r.jina.ai` on any non-200 or on a 200 with no mention (this catches client-rendered pages whose
  text is not in the served HTML). Sending the same headers to both silently disables the fallback
  — direct and proxy headers are kept as separate constants for that reason.
- Default 3 s pacing between records: the proxy throttles a burst, and a throttled response reads
  exactly like a hard block.
- Brand forms (`layoffhedge`, `layoffai`) and weak forms (`official layoff`, spaced `layoff AI`)
  are counted and reported apart — a page whose only hit is a weak form is listed as a reason to
  read it, never as a reference.

---

## 7. `pnpm sweep:mentions` (Track A)

**What it is for.** A full-archive search over every post whose *text* names the account, the
brand word, or the domain — the complement of `sweep:quotes` (Track B), which finds quote posts
that attach a card rather than text. The two barely overlap: none of the pre-existing amplification
records were findable by Track A. Track A finds outlets and commentators; Track B finds
officeholders.

**Commands.**
```bash
pnpm sweep:mentions                          # size the window with counts and stop
pnpm sweep:mentions -- --sweep                # actually fetch, profile and report
pnpm sweep:mentions -- --since-id <id>        # override the stored high-water mark
pnpm sweep:mentions -- --start-time <ISO>     # a date window instead of an id
pnpm sweep:mentions -- --max-pages 10         # cap pages walked (default 10)
pnpm sweep:mentions -- --sweep --dry-run      # fetch, report to stdout, write no files
```

**Cost.** $0.01 per 31-day page for sizing (`counts`); enumeration and profile resolution bill per
resource returned (`docs/PROVIDERS.md §2`).

**Reads and writes.** Strictly read-only against `data/` — it reports candidates and prints what a
human must confirm and where (`verificationClaims()`, §1). State lives in
`research/track-a-state.json`: the `since_id` high-water mark, the window covered, one line per
run — written only after a successful sweep, from the API's own `newest_id`.

**Credentials.** `X_BEARER_TOKEN`.

**Known traps.**
- Sizing is the default; only `--sweep` bills.
- The state mark moves only forwards, and only after success: a mark that moves backwards re-buys
  a paid window, one that moves forwards after a failure silently skips posts nobody has seen.
- After a gap longer than 30 days, pass `--start-time` explicitly rather than trusting `--since-id`
  alone — see the routine's note (§2).

---

## 8. `pnpm sweep:quotes` (Track B)

**What it is for.** Enumerates the accounts that quoted a tracked post, drops the ones already
recorded, and reports the rest for a human to read. All four federal legislators currently in
`data/amplifications.json` surfaced by accident before this tool existed; it makes the search
systematic instead of lucky.

**Commands.**
```bash
pnpm sweep:quotes                                   # measure only — one billed request
pnpm sweep:quotes -- --post <post-id|status-id>     # sweep one post
pnpm sweep:quotes -- --all --max-pages 5            # walk the set, largest first (default 10)
pnpm sweep:quotes -- --profiles 20                  # accounts that get a profile lookup (default 30)
pnpm sweep:quotes -- --delay 1500                   # pacing between requests (default 1200ms)
pnpm sweep:quotes -- --post <id> --dry-run          # no report file written
```

**Cost.** Two separate budgets, both `docs/PROVIDERS.md §2`: enumeration bills per post returned
(phase one, no `expansions` — `author_id` rides along free), profile resolution bills per user
returned (phase two, one batched call for the top `--profiles` accounts, ranked by their own
quote post's engagement). `--measure` (the default) is one billed request: it reads every tracked
post's metrics, about $0.16 for 32 posts.

**Reads and writes.** Strictly read-only against `data/` — never writes an amplification; promotion
is a human edit. Per-post reports go to `research/quote-sweeps/<status-id>.json`. Every profile
received is written to `research/x-api-profiles.json`, keyed by account id and merged newest-first;
the store is rebuilt from every `.json` under `research/` on each run, so a profile bought under
some earlier file the store never learned about is never bought twice.

**Credentials.** `X_BEARER_TOKEN`.

**Known traps.**
- The binding constraint is a credit budget, not the rate limit: a run can fail with
  `402 credits depleted` on every endpoint while the rate limit still shows headroom. `--max-pages`
  caps what a run can spend, not how many requests the rate limit allows.
- A failure mid-pagination keeps the pages already paid for and records why it stopped
  (`stoppedBy`) — a run must never discard completed work on the next call's error.
- Flags (`government-verified`, `role-phrase`, `large-following`) are signals to read, never a
  ranking — no score, no order of merit.
- The register match (`unitedstates/congress-legislators`, current and historical, matched by
  display name) catches known federal legislators but is silent on state legislators, executive
  appointees, personal accounts and second official handles. A match is a reason to look, never a
  verification.

**Measured.** The endpoint's timeline is mostly not quotes of the post: 94 of the first 96 entries
on the highest-quote post were plain retweets; with `exclude=retweets` applied the next 392 entries
still resolved to 199 quotes and 151 replies — hence the request excludes retweets and the tool
separately confirms `referenced_tweets` carries `quoted → this post`. Register match against the
eight federal legislators recorded at the time: name matching caught 8 of 8, handle/account-id
matching caught 2.

---

## 9. `pnpm review:profiles`

**What it is for.** Re-reads every profile already paid for and reports which accounts a human
should look at, with the criterion that fired. Makes no network request of any kind — the reading
is free, only the underlying data was expensive, and the review criteria have already changed more
than once since profiles started accumulating.

**Commands.**
```bash
pnpm review:profiles                  # every account meeting at least one criterion
pnpm review:profiles -- --floor 1000  # lower the follower criterion (default 5,000)
pnpm review:profiles -- --all         # print every account, criterion or not
```

**Cost.** Free.

**Reads and writes.** Reads every `.json` under `research/` and `data/`. Writes nothing.

**Credentials.** None.

**Known traps.**
- The follower floor (default 5,000) applies **only** to the follower criterion; a register match,
  a `government` verified_type, or a role phrase is reported at any account size.
- The floor is inherited from a Track A reading, not invented here — see Measured.

**Measured.** Track A checked all 210 authors below 5,000 followers and found 16 with a role phrase
and none with weight — that reading is where the default floor comes from. A pass over 448 accounts
not yet recorded found: register match 3, government verified_type 0, role phrase 20, followers
≥5,000 55.

---

## 10. `pnpm sweep:web`

**What it is for.** Asks a web-search vendor which pages cite this project, diffs the results
against `data/media.json`, and sorts them into the project's own surfaces, pages already recorded,
link-only surfaces to archive on sight, and candidates. `--fetch` chains the free verification
stage (§6's fetch-and-detect core) onto the run, so it can end with "N pages that name this
project" rather than a bare URL list.

**Commands.**
```bash
pnpm sweep:web                               # print the query set and its modelled cost; no request
pnpm sweep:web -- --sweep                    # run the set — this bills
pnpm sweep:web -- --sweep --query brand-closed               # one query, by exact label
pnpm sweep:web -- --sweep --query brand-closed,brand-spaced   # several, comma-separated
pnpm sweep:web -- --sweep --max-queries 5    # lower the ceiling; nothing can raise it
pnpm sweep:web -- --sweep --freshness py     # recency filter, vendor's own syntax
pnpm sweep:web -- --sweep --pages 2          # extra result pages (default 1; Serper news default 2)
pnpm sweep:web -- --sweep --extra-snippets   # opt-in, may be plan-gated
pnpm sweep:web -- --sweep --since-last --fetch                        # only what's new per query
pnpm sweep:web -- --vendor serper-news --sweep --since-last --fetch   # Google News via Serper
pnpm sweep:web -- --yield                    # per-query yield from the ledger; no request
```

**Cost.** Brave: $0.005/query (`docs/PROVIDERS.md §3`) — measured full sweep of 14 queries, $0.070.
Serper: free credits while the balance lasts (`docs/PROVIDERS.md §4`).

**Reads and writes.** Reads `data/media.json` to diff results against. Every response is archived
under `research/brave-search-<day>/raw/` or `research/serper-<day>/raw/` before parsing. Each sweep
writes `research/brave-search-<day>/sweep-<time>.json` (or the Serper equivalent) and
`candidate-urls-<time>.txt`, in exactly the format §6's `--urls` reads. Per-query high-water marks
live in `research/web-sweep-state.json` (Brave) and `research/web-sweep-state-serper-news.json`
(Serper) — separate files, because a window from one vendor's index must never gate the other.
Ledgers: `research/brave-search-ledger.json`, `research/serper-ledger.json`, one line per billed
request. Never writes `data/`.

**Credentials.** `BRAVE_SEARCH_API_KEY` and/or `SERPER_API_KEY`, per vendor used.

**Known traps.**
- `--query` takes exact labels, not substrings — an unknown label spends nothing and prints the
  list of labels instead.
- Brave carries a hard ceiling of 60 queries per run that no flag can raise, paces one query at a
  time, and aborts on the first non-200 rather than retrying (`docs/PROVIDERS.md §3`).
- `--since-last` marks a high-water mark **per query**: a query the state has never seen, or one
  reworded since, is swept unrestricted rather than windowed — the conservative direction, since a
  window applied to a query that has never seen the archive reports a clean nothing while skipping
  everything.
- `--pages` defaults to 1 because most queries have no second page; a page is only bought when the
  previous page says one exists (Brave) or after a full first page (Serper, which has no such
  signal). Depth is diminishing return: the tested pairs that had a second page and a known hit
  found 0 new hits on it despite new candidates.
- The query set is versioned (`QUERY_SET_VERSION`); two reports are comparable only when the
  version matches. Re-run the calibration set (`research/web-sweep-calibration.txt`) after
  rewording any query — a precision-looking edit has silently dropped a known hit before.
- Serper's `/news` accepts Google's custom date range and then ignores it; the client rounds it up
  to the nearest fixed bucket instead.
- Some query patterns are refused outright by Serper's free tier — skipped before any request, at
  no cost.

**Measured.** First full sweep (14 queries, $0.070): 97 distinct URLs → 46 candidates → 11 brand
hits after the free fetch pass, 5 of them genuine citations — roughly one real candidate per $0.014
and one fetch pass per five real candidates. A parallel run through Serper News on the same
questions found one citing publication Brave's index never held, while Brave found citations
Serper's web search did not — neither index contains the other on this project's long tail, so both
stay in the routine.

---

## 11. `pnpm check:visual`

**What it is for.** The browser review pass for any change that renders UI: screenshots the site
at three widths plus a reduced-motion and a no-JavaScript pass, and asserts there is no horizontal
overflow and nothing left below full opacity. It is built to be gentle on a small machine: it runs
one step at a time and refuses to start when memory is short.

**Commands.**
```bash
pnpm check:visual                    # 390 / 768 / 1440, output in .visual-check/
pnpm check:visual --widths 390,1440
pnpm check:visual --path /archive
pnpm check:visual --anchor archive   # a section below the fold
pnpm check:visual --out ./review-shots
```

**Cost.** Free — a local browser only.

**Reads and writes.** Requires a `.next` build to already exist (it never builds). Screenshots land
in the gitignored `.visual-check/` (or `--out`). Writes nothing to `data/` or `research/`.

**Credentials.** None.

**Known traps.**
- On Windows, run it from PowerShell, not Git Bash: MSYS rewrites `--path /archive` into a Windows
  path before the script ever sees it.
- One thing at a time, in order: `debug` (typecheck/lint/test/validate/build, as separate commands)
  → `server` alone → `screens` (one browser, one context, `deviceScaleFactor` 1) → `close` (browser,
  then server, then verify the port is free). The script refuses to start under 3 GB of free RAM,
  with no `.next` build, or if port 3000 is already serving.
- Never `fullPage` on a tall page or `deviceScaleFactor: 2`: a full-page raster at 2x can exhaust
  the memory of an 8 GB machine.
- `--anchor <id>` appends a URL fragment rather than scripting a scroll, so the same capture works
  with JavaScript disabled; it also reaches inside a closed `<details>`, since current Chromium
  auto-expands one when navigating to a fragment inside it.
- Reviewing two routes in one session without distinct output can silently overwrite the previous
  run's reduced-motion/no-JS captures — every screenshot is prefixed with its route (and anchor)
  for this reason.
- On Windows, MSYS `pgrep`/`pkill` see no processes; use PowerShell `Get-Process` /
  `Stop-Process` for cleanup.

---

## 12. The shared sweep modules

The discovery tools are thin scripts over pure modules in `src/lib/sweep/`, unit-tested without a
disk or an API call, so a rule fixed in one tool is fixed in every tool that shares the module.

| Module | Owns |
|---|---|
| `quote-candidates.ts` | who is already known, the role-phrase and following signals, the self-account exclusions, and `verificationClaims` (§1) |
| `legislator-index.ts` | the Congress register — CSV parsing, and matching an account by name, handle or account id |
| `profile-store.ts` | recognising a paid user object and folding readings newest-first, so nothing is bought twice |
| `raw-archive.ts` | where a billed response goes the moment it arrives (§1) |
| `mention-patterns.ts` | what counts as this project's name on someone else's page, brand forms apart from weak ones (§6) |
| `page-probe.ts` | the direct→proxy fetch-and-detect core both input modes of §6 share |
| `url-list.ts` | the `--urls` file format, and a readable unique id per target |
| `web-search-results.ts` | normalising a result URL, diffing it against `data/media.json`, and the archive-on-sight verdict (§10) |
| `web-queries.ts` | the versioned query set of the web sweep, and why each query is worded as it is (§10) |
| `cost-ledger.ts` | the record of spend — one entry per billed request, the free verification passes beside it, and per-query yield across every run (§10) |
| `sweep-state.ts` | the web sweep's per-query high-water marks, and the rule that a new or reworded query is swept unrestricted (§10) |

They live in `src/lib` rather than `scripts/` for the same reason `src/lib/validation/placeholder.ts`
does: the decisions they encode are the ones a silent bug would be most expensive in, and pure
functions can be tested without spending an API budget to exercise them.
