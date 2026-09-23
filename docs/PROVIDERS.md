# PROVIDERS.md

Owns: the paid data vendors — what they cost, how they fail, and what a request must get right.
Read this before running or changing `pnpm sweep:mentions`, `sweep:quotes`, `enrich:twitter`,
`refresh:metrics` or `sweep:web`. What each tool does and its command-line flags are
`docs/TOOLS.md`'s job, not this file's.

---

## 1. How to read this file

**Where a vendor publishes a machine-readable spec, the spec is the source of truth** for every
contract question — which endpoints exist, what parameters they take, types, enums, required vs
optional, response shapes. This file does not restate any of that. It holds only what a spec
cannot say: price, billing behaviour, behaviour under load, error semantics, a field that is
documented but behaves unexpectedly, traps, and procedure.

Where no spec exists, this file says so plainly and names what serves as the reference instead.

Every measured figure below carries the date it was measured. A number without a date is a
documented claim, not an observation, and the two are never presented as the same kind of fact.

**Reporting a correction.** If a figure here stops matching reality, open a pull request that
changes the line and attaches the raw response (or a redacted excerpt of it) as evidence. A claim
in this file is worth exactly as much as the request that produced it — see §2.3.

---

## 2. X API v2

### 2.1 Spec and authentication

`https://api.x.com/2/openapi.json` is public, free, and needs **no token** — verified 2026-09-23:
HTTP 200, OpenAPI 3.0.0, `X API v2` version 2.168, 159 documented paths. It is the reference for
every endpoint, parameter, type, enum, maximum and default this section would otherwise have to
restate.

CI downloads a fresh copy before `pnpm test` and points `tests/api-field-validity.test.ts` at it,
so every field name every script sends is checked against a live spec on every push, not a stale
local one. Locally, the test reads `research/x-api-2026-09-20/openapi.json` if CI's copy is not
present, and skips outright if neither exists — the guard degrades rather than blocking work with
no spec on disk.

Requests carry a bearer token in `X_BEARER_TOKEN` (`.env.local`, never committed). The official
docs site is `docs.x.com`; the pricing terms below are quoted from X's own pricing page, read
2026-09-20.

### 2.2 Billing

X bills **pay-per-use credits, per resource returned — never per request and never per field.** A
call returning 500 posts costs 500 reads regardless of how many fields were requested on each one.
Page size saves requests, not money.

| Resource | Price | Source |
|---|---|---|
| Post read | $0.005 | X's pricing page; confirmed exact on a metered single-resource call, 2026-09-21 |
| User read | $0.010 | X's pricing page; confirmed exact, 2026-09-21 |
| Owned read (your own account's data — see 2.6) | $0.001 | X's pricing page only — not measured here |

**Ask the API what you spent; do not model it.** `GET /2/usage/credits` returns the live balance,
broken down into a prepaid component and a free component plus their sum.

A companion endpoint reports posts consumed against the monthly cap. Read the balance before a
run and again after; the difference is the exact cost and cannot be wrong the way a per-resource
estimate can. A mixed-resource estimate
that divides one total by one resource count silently blends prices — a real run measured
$0.0068/post that way, when the true rate, confirmed on a clean single-resource call, was exactly
$0.005/post with no premium (2026-09-21).

**Resources deduplicate within a 24-hour UTC window.** The same resource returned twice the same
day is billed once. Re-running a query to iterate on it the same day is effectively free; do not
estimate spend by summing response sizes across repeated calls, and do not assume a re-fetch
tomorrow is free — the window resets.

**The credit budget and the rate limit are independent meters.** Measured 2026-09-20: after about
14 requests an account began returning `402 credits depleted` on every v2 endpoint, including
plain tweet lookups, while rate-limit headers on the same responses still showed thousands of
requests remaining. A `402` means the credit balance is empty; a `429` means the rate window is
full. Waiting clears the second, never the first — only adding credit does.

### 2.3 Request vocabulary and silent failures

**An unknown field or expansion value is dropped silently: HTTP 200, `errors: []`, and the field is
simply absent from the response — and it is still billed.** A 200 response proves a request was
accepted, never that it was understood. There is no error path here to catch a typo; the only
defence is validating every field name against the spec before sending it (2.1) and asserting on
the first page of a paginated run that the fields it depends on actually arrived.

**Two field-parameter dialects exist, and mixing them loses data with no error.** The spec's
current vocabulary is `post.fields` / `PostExpansionsParameter`, whose enum includes `note_post`
and `referenced_posts`; a request sent as `tweet.fields` (a legacy alias, still present elsewhere
in the spec though not documented for these endpoints) gets back `note_tweet` and
`edit_history_tweet_ids` instead. Both dialects work and both return the same content under
different keys — a request sent in one and read in the other returns real data that looks empty
under the key being checked.

**In the `post.fields` vocabulary, `author_id` and `referenced_posts` are expansions, not
fields** — confirmed against `PostFieldsParameter`, which carries neither. Requesting them under
`post.fields` is silently ignored by the rule above: every entry then fails any check that depends
on `referenced_posts`, and a sweep can page through an entire post, bill for every entry, and
report zero matches. The two ways to obtain them do not cost the same:

```text
tweet.fields=…,author_id,referenced_tweets    legacy dialect; both ride as post fields, no extra user read
post.fields=…  + expansions=author_id,…       current dialect; author_id costs a user read per page
```

**"When a documented field comes back empty, suspect your own request first."** `note_post`
carries the full text of a long post past the point the trimmed `text` field truncates it. A
48-post, $0.24 re-fetch that read the field under the matching dialect recovered 32,495 characters
across 34 of the 48 posts — text that had been silently discarded, not text the API withheld.
Always keep the raw response body next to whatever is derived from it: a field the API genuinely
omitted and a field your own request never asked for correctly look identical once the response
has been parsed away and discarded.

### 2.4 Search, counts and pagination

**Full-archive search cannot see quote posts.** A quote post attaches the original as a card, not
as text; unless the author also types the handle, the quoted account appears nowhere in the
quoting post's searchable text. Tested against ten hand-verified amplifiers: zero were findable by
any text-search query, including narrow ones aimed at each individually. This is why a separate
`quote_tweets` sweep exists rather than a second search query — search is not a substitute at any
price for enumerating who quoted a specific post.

**`counts` prices a fetch; it is not a completeness check.** `GET /2/tweets/counts/all` (and
`/counts/recent`, identical in price and answer on a short window) costs $0.01 per request flat,
independent of how many posts the window holds, and one response covers at most 31 days at daily
granularity — a longer window costs $0.01 per 31-day slice. A `quote_count` on a post is the same
kind of estimate: deleted posts, protected accounts and blocks all sit in the gap between the
reported count and what an enumeration actually serves, so a sweep that keeps paging until it
reaches the advertised number will page forever.

**Some pagination tokens re-issue forever.** Measured on `quote_tweets`: from a certain page
onward, every subsequent page returned the identical single post with a fresh `next_token` each
time, with no signal that the list had ended. `next_token` being present is not a promise that
new content remains. Guard with a counter of consecutive pages that add no new id, not with "loop
until the token disappears."

**Sizing constant for planning a quote sweep:** distinct authors run at roughly **0.85 × the
number of quotes reported**, and enumerated entries run close to the reported quote count once
retweets and replies are excluded. Use both to price a sweep before running it, never as an exact
figure.

### 2.5 Users and identity signals

**`expansions=author_id` bills a user read on every page an account's post appears on.** On a
paginated, many-page job this adds up; buy full profiles once, for a shortlist, rather than as a
byproduct of enumeration.

**`verified_type` has two readable values, and they mean very different things.** `"blue"` is a
paid subscription and carries no information about role — measured across several hundred
profiles, it splits roughly evenly between `blue` and `none` with no correlation to public office.
`"government"` is the one value that names an actual office, and it is rare: about 0.2% of a
paid profile set in this project's own measurements. Treat `government` as a low-base-rate
detector, never as a query filter to size a run with, and never treat `blue` as a signal at all.

**Underused `user.fields`, all free to add once a profile is already being bought** (billing is
per resource, never per field — 2.2):

| Field | Why it matters |
|---|---|
| `parody` | X's own parody flag — catches a bio that reads as a real role but is satire |
| `is_identity_verified` | government-ID verification, a different thing entirely from `verified_type: blue` |
| `entities` | expanded URLs in the bio — a link to an official domain is a signal that arrives at no extra cost |
| `verified_followers_count` | a less noisy size reading than the raw follower count |

**A match against an external register (for example a legislators' directory) is a reason to look
closer, never a verification.** Registers key on handle or account id, both of which are unstable:
a public figure may use a personal account the register does not list, may hold more than one
official-looking handle, or may have left the office the register still credits them with. Match
on the person's **name** instead where the register supports it — it is the one key stable across
every account a person ever opens — and confirm identity from an independent source regardless of
which key matched.

### 2.6 Endpoints each script calls

| Script | Endpoint(s) | Billed resource | Default run spends? |
|---|---|---|---|
| `sweep:mentions` | `/2/tweets/counts/all` (sizing) · `/2/tweets/search/all` (`--sweep`) · `/2/usage/credits` (metering) | count buckets ($0.01/request) · posts | No — sizes only, `--sweep` bills |
| `sweep:quotes` | `/2/tweets` (metrics lookup, `--measure`) · `/2/tweets/{id}/quote_tweets` (enumeration) · `/2/users` (profile batch) | posts · users | **One request.** `--measure`, the default, reads every tracked post's metrics, billed per post; enumeration needs `--post` or `--all` |
| `enrich:twitter` | `/2/tweets` | posts, plus one user read per distinct author (`expansions=author_id`) | No — plans by default, `--fetch` bills |
| `refresh:metrics` | `/2/tweets` (metrics lookup) · `/2/usage/credits` (metering) | posts | No — plans by default, `--fetch` bills |

An outside observer measuring an account it does not control pays list price for everything.
X exposes an **owned read at $0.001** — a tenth of a normal user read — through endpoints only the
authenticated account itself can call (`GET /2/users/reposts_of_me`, `GET /2/tweets/analytics`,
`GET /2/usage/*`). None of this project's tooling can reach that tier, because it measures an
account it does not own and must never authenticate as. If you run the measured account yourself,
or fork this project to measure your own account, the same operations — retweet enumeration above
all — cost roughly a tenth of what they cost here.

---

## 3. Brave Search API

**No OpenAPI specification exists** — probed 2026-09-22 across six candidate paths
(`/openapi.json`, `/api/openapi.json`, `/api-reference/openapi.json`,
`/documentation/openapi.json` on the dashboard host, and two on `api.search.brave.com`); every one
returned 404 or 403. The vendor's reference site embeds no spec URL. **The reference instead is
the vendor's own parameter documentation**, kept as dated copies under
`research/brave-search-2026-09-22/reference/` and checked on every parameter the client sends.

Auth travels in the `X-Subscription-Token` header (not a bearer token), from `BRAVE_SEARCH_API_KEY`.

**Billing: $5 per 1,000 web-search queries.** The free plan was withdrawn in February 2026 — a
card is required at signup and is charged once any included credit runs out — and **there is no
default spending cap**; one must be set in the vendor's own dashboard before the first call.
**There is no balance endpoint**, unlike X's `usage/credits`, so nothing can be metered before and
after a run the way the X tools are. The project keeps its own per-request ledger instead and
checked it against the dashboard once: 21 requests and ~$0.10 on both sides, 2026-09-22. A modelled
cost that has agreed with the vendor's own figure once is still a model, not a meter, and is
labelled as one everywhere it appears.

**Parameters this project sends, and why — each checked against the dated reference:**

| Parameter | Value sent | Why |
|---|---|---|
| `spellcheck` | `false` (boolean, not `"0"`) | an unknown parameter *value* — not name — fails the same silent way X's unknown fields do |
| `text_decorations` | `false` | otherwise the vendor injects highlight markup into `description`, corrupting any text match run against it |
| `result_filter` | `web,news` | keeps the two verticals that can carry an article; drops videos, FAQs, discussions and infoboxes |
| `count` | ≤ 20 | the vendor's own cap |

**Parse `news.results[]` as well as `web.results[]`.** News results arrive in a separate array; a
citation sweep that reads only `web.results` silently drops part of the population it exists to
find. `query.more_results_available: false` means no further page exists — it does not mean no
further match exists elsewhere in the index; a query that returns a small, closed result set can
still miss a page a narrower query (e.g. `site:` plus an exact phrase) finds.

Used by `pnpm sweep:web` (default vendor).

---

## 4. Serper (Google Search / Google News)

**No documentation and no OpenAPI specification** — `serper.dev/docs`, `/openapi.json`,
`/api-docs` and `/llms.txt` all 404; `google.serper.dev/` alone 403s (measured 2026-09-23). **The
contract is the vendor's own playground bundle** (its bundled JavaScript, which enumerates the
endpoint list, request body fields and credit formula), kept as dated copies under
`research/serper-2026-09-23/`.

Auth travels in the `X-API-KEY` header, from `SERPER_API_KEY`. Requests are `POST
https://google.serper.dev/news` with a JSON body.

**Free tier: 2,500 credits, no card required.** `GET /account` reports the balance for free and
was read three times with no movement between reads, but **the meter lags a real charge by a few
seconds** — trust the `credits` field carried in each response body over a balance read taken
immediately after a run. On the first 27 metered requests the two agreed exactly once the balance
read was given time to settle.

**The free tier refuses `num` above 10** with HTTP 400 ("Query pattern not allowed for free
accounts") at zero cost, so depth means a second page (`page=2`), not a larger page. There is no
"more results" flag on this endpoint, so an empty second page still costs a credit. **Some query
patterns are refused outright on the free tier** — an exact handle in quotes and a bare domain
both drew the same 400 at zero cost in this project's own testing, while the unquoted brand word
was accepted; a tool that runs against this vendor should check a query against the known-refused
list before spending a request on it.

**`/news` accepts a custom date range parameter and silently ignores it.** A one-day window
returned articles four months old; the vendor's coarser recency buckets (day/week/month/year)
worked as documented. Round a requested window up to the nearest bucket that contains it rather
than trusting the echoed parameter as proof it was applied.

Used by `pnpm sweep:web -- --vendor serper-news`, run alongside Brave rather than in place of it.
The tool checks the account balance against the worst-case cost of a run (queries × pages) before
spending, and refuses rather than running partway and failing on a depleted balance.
