# research/

Local working data for this project's paid discovery tools (`pnpm sweep:mentions`,
`sweep:quotes`, `sweep:web`, `refresh:metrics`, `enrich:twitter` — see `docs/TOOLS.md` and
`docs/PROVIDERS.md`). A fresh clone of this repository has no `research/` folder at all; the
tools create whatever they need under it the first time they run.

**This is not a cache.** `.cache/` is the disposable folder — cleared without thought, next to
`.next/` in `.gitignore`. `research/` holds paid readings that some of the tools cannot re-take at
the same price, or at any price: a follower count, a bio, or a post's text on a given day is a
reading of that moment, not a fact that can be re-fetched unchanged later.

**None of it is published, on purpose.** The files here are raw third-party API responses,
several of which hold hundreds of public people's profile data pulled for identification work.
Republishing that dump is neither necessary — the derived, verified records live in `data/`,
which *is* published — nor respectful of the people in it, and redistributing platform content
this way runs against the terms the data was obtained under. So the folder is gitignored except
for this file.

## What writes what

| Path pattern | Written by | Holds |
|---|---|---|
| `x-api-<day>/raw/<label>-<time>.json` | `sweep:mentions`, `sweep:quotes`, `refresh:metrics`, `enrich:twitter` | every billed X API response, archived before anything parses it |
| `x-api-profiles.json` | `sweep:quotes` | every X user profile ever paid for, accumulated across runs and keyed by account id, so nothing is bought twice |
| `quote-sweeps/<status-id>.json` | `sweep:quotes` | one enumeration report per swept post — author ids, candidates, why pagination stopped |
| `track-a-state.json` | `sweep:mentions` | the incremental high-water mark for the mention sweep, so a re-run only buys what is new |
| `post-metrics/tracked-post-metrics-<date>.json` | `refresh:metrics`, `sweep:quotes` | a dated reading of every tracked post's public counters |
| `brave-search-<day>/raw/*.json`, `serper-<day>/raw/*.json` | `sweep:web` | every billed web-search response, one vendor's folder per day |
| `brave-search-<day>/sweep-<time>.json`, `candidate-urls-<time>.txt` | `sweep:web` | one run's report and the candidate URLs handed to the free verification step |
| `web-sweep-state.json`, `web-sweep-state-serper-news.json` | `sweep:web` | per-query, per-vendor high-water marks for `--since-last` |
| `brave-search-ledger.json`, `serper-ledger.json` | `sweep:web` | the record of spend — one entry per billed request |
| `x-api-2026-09-20/legislators-*.csv` | fetched by hand from `unitedstates/congress-legislators` on GitHub | the register `sweep:quotes` matches candidates against, read from this fixed folder. Free, re-downloadable, not paid data |
| `web-sweep-calibration.txt` | maintainer, by hand | known pages a sweep must keep re-finding, kept outside any single run's output |

A response is written before it is read, so a field the vendor genuinely omitted and a field the
request never asked for correctly can still be told apart after the fact — see
`docs/PROVIDERS.md §2.3`.

## Local notes

Local working notes may sit beside this file — for a maintainer's own bookkeeping, not part of
the published project. They are not required to run or understand anything here.
