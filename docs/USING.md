# Using this project

What it is, how to run it, and how to check its numbers yourself.

For the thesis and scope see `PRODUCT.md`; for the record formats see `DATA.md`; for the stack and
scripts see `ENGINEERING.md`. This page is the way in.

**Independent community project. Not affiliated with or endorsed by LayoffHedge.**

---

## 1. What this is

A static website that documents the public attention around LayoffHedge — how far its posts
travelled, who amplified them, and which publications referenced it — using data anyone can check.

Every number on the site is **derived from source records**, never typed in. Every record carries a
link to the public thing it describes. If a record's source cannot be opened, the record does not
belong in the dataset.

It is **not** a token page, a price dashboard, a SaaS analytics product, or an official LayoffHedge
site. It has no buy button, no wallet, no accounts, no newsletter, and no logins.

### What the numbers mean, and what they do not

The site is careful with language because the underlying data only supports careful claims:

| What is printed | What it means |
|---|---|
| `OBSERVED VIEWS ACROSS TRACKED POSTS` | the sum of the view counters on posts we track, each read on a recorded date |
| `TRACKED POSTS` | posts in the dataset with a verified source |
| a publication's reference count | how many verified references that publication has |

A view count is **an observation paired with a date**, not a number of people. The same person may
appear in many posts. The site never prints "reach", "impressions" or "people reached", and it
never invents a composite score — no Attention Score, no Influence Score, no ranking of amplifiers.
Recording that someone amplified a post is a statement about an act, never an endorsement of them
or by them.

---

## 2. Run it locally

Requires Node 20+ and `pnpm` (`corepack enable pnpm`).

```bash
git clone https://github.com/0xFlimbo/attention-index
cd attention-index
pnpm install
pnpm dev            # http://localhost:3000
```

There is no database, no API key and no environment file needed to run the site. The data is the
JSON in `data/`, read at build time. The whole site is statically generated.

```bash
pnpm build && pnpm start    # production build
```

### Check it the way CI does

```bash
pnpm validate:data && pnpm check:production-data && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`validate:data` parses every record against its schema. `check:production-data` is the one that
enforces the project's editorial rules in code: no placeholder record may be publicly visible, and
every headline metric must derive from `verified` records only.

---

## 3. Verify a number yourself

This is the part that matters, and it is meant to be easy.

1. Open `data/posts.json`, `data/amplifications.json` or `data/media.json`. They are plain JSON,
   human-readable, and licensed CC BY 4.0.
2. Pick any record and open its `evidence_url` or `url`. That is the public post or article.
3. Compare. A post record stores an **observation history** — each reading with the date it was
   taken — so a counter that has since moved does not make the record wrong; it makes it dated,
   which is the point.
4. Recompute a headline figure: every derived number is a pure function in `src/lib/metrics/`,
   with tests in `tests/`. `pnpm test` recomputes them from the JSON on disk.

Found something wrong? See §6.

---

## 4. How a record gets in

Deliberately slow, and deliberately human at the last step.

```text
discovery  ->  verification  ->  a person writes the record  ->  status: verified
```

- **Discovery** finds candidates: a press page, a web search, or a sweep of who quoted a post.
- **Verification** means someone opened the source and confirmed it says what the record claims.
  Identity is checked against **independent** sources — an account's own bio is self-reported and
  is never treated as proof.
- **A person writes the record.** No tool in this repository writes to `data/`. Every maintenance
  script reports candidates and stops.

That last rule is the important one. A discovery sweep has nothing upstream vouching for its
results, which is exactly where automatic promotion would do the most damage.

`status: "verified"` means *a maintainer checked that the public source supports this record*. It
does not mean verified by X, audited, or confirmed by LayoffHedge. Records awaiting that check are
`needs_review` and never appear in any public figure.

---

## 5. The maintenance tools

Occasional, run by hand, never part of a build or CI. Full detail in `ENGINEERING.md §16–§20`.

| Command | What it does | Network | Cost |
|---|---|---|---|
| `pnpm import:press` | imports the official press page as `needs_review` candidates | yes | free |
| `pnpm check:media-mentions` | fetches a stored article and confirms it mentions the project | yes | free |
| `pnpm enrich:twitter` | fills post metadata from the X API | yes | **paid** |
| `pnpm sweep:quotes` | enumerates who quoted a tracked post | yes | **paid** |
| `pnpm review:profiles` | re-reads profiles already paid for, reports who to look at | **no** | free |
| `pnpm check:visual` | screenshots the site at three widths | local browser | free |

The paid ones need `X_BEARER_TOKEN` in `.env.local` and spend real money per request. If you are
forking this, read the cost model before running either: **X bills per resource returned**, so a
call that returns 500 posts costs 500 reads, and page size saves requests rather than money.

Two habits worth copying:

- **Read `GET /2/usage/credits` before and after every run.** The difference is the exact cost.
  Nothing else is reliable.
- **Nothing paid for is thrown away.** Raw API results live outside any cache directory, and every
  profile ever fetched is kept so a later run reuses it instead of buying it again.

### If you are the account being measured

The economics are roughly ten times better for the owner of an account than for an outside
observer, because X bills an *owned read* at a tenth of a normal one and exposes endpoints only the
account itself can call. If you run LayoffHedge — or you want to point this method at your own
account — that is worth knowing before concluding it is unaffordable.

---

## 6. Corrections and contributions

The dataset is meant to be corrected in public. If a record is wrong, or a source no longer
supports it, open an issue or a pull request — see `CONTRIBUTING.md` for the record formats and the
evidence bar.

Corrections are handled through repository history, without defensive language. Data is
periodically reviewed and corrected when stronger source information becomes available.

**Licensing** is MIT for the code and CC BY 4.0 for `data/` — the split is deliberate, asking
attribution for the verification work rather than for the code. Full terms and the attribution
string are in `README.md`.

---

## 7. Forking it for a different subject

Nothing in the architecture is specific to LayoffHedge. To point it at another account or project:

1. Replace the contents of `data/` and update `data/project.json`.
2. Update the copy that names the subject — `HOMEPAGE.md` owns the approved wording.
3. Keep the independence statement on every page, and keep the subject's name out of the
   repository name and domain. Naming what you measure is necessary; naming yourself after it
   reads as affiliation.

The parts most worth reusing are the boring ones: the schemas, the derived-metric functions, the
placeholder guard, and the rule that a tool reports while a person records.
