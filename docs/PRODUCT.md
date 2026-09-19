# PRODUCT.md

Owns: thesis, scope, audience, information architecture, success criteria.
(Consolidated from the original `PRODUCT_SPEC.md`, kept in `docs/archive/`.)

---

## 1. Name and identity

Working name: **LayoffHedge Attention Index**.

Site wordmark:

```text
LAYOFFHEDGE / ATTENTION INDEX
```

Always paired with a persistent, visible unofficial/independent clarification.

---

## 2. Thesis

> LayoffHedge is notable because its attention moved beyond the crypto-native audience
> and entered broader public discourse.

The product documents one asset: **attention**. The token is downstream and secondary.

Narrative progression the site must follow:

```text
1. Attention exists.
2. It is measurable.
3. It is unusually large.
4. It did not stay inside crypto.
5. External actors amplified it.
6. Media referenced it.
7. The evidence is public.
8. Anyone can verify or contribute.
```

Never lead with token price, utility, market cap or speculative upside.

---

## 3. Positioning

Closer to: data journalism, public research, open-source evidence archives, editorial reporting.
Not: token landing pages, hype pages, memecoin sites, analytics dashboards, IR pages.

Differentiator = **credible visual documentation of real-world attention**, not technical complexity.
Optimize for `visual impact + clarity + credibility + source transparency`.

---

## 4. Four pillars

1. **Attention** — public reach measured from public evidence (view thresholds, top post, totals).
2. **Crossover** — audience beyond crypto: politics, government, journalism, media, business, tech.
3. **Evidence** — every major claim links to a public source.
4. **Open source** — public dataset and code; contributions via GitHub PR with sources.

---

## 5. Audience

| Audience | What they need |
|---|---|
| First-time visitor | what happened, how large, why it's unusual, why it matters beyond crypto |
| Existing followers | structured archive, evidence, a way to contribute |
| Media / researchers | inspectable posts, links, dates, references, citable dataset |
| Crypto-native users | why external attention is the differentiator |
| The LayoffHedge team | something they could reference, contribute to, or fork later |

The visitor should not need to understand crypto to follow the story.

---

## 6. Questions the homepage must answer

```text
What is this?
How much attention did LayoffHedge generate?
Which posts were the biggest?
Who amplified them?
Did the reach move outside crypto?
Which media outlets referenced the project?
Can I verify these claims?
Can I contribute corrections or data?
```

A section that answers none of these probably does not belong in V1.

---

## 7. V1 scope

In scope:

```text
Homepage · attention metrics · viral archive · crossover · amplification records
public references · evidence · methodology · about · GitHub repo · structured JSON data
```

Out of scope for V1:

```text
accounts · auth · database · admin panel · CMS · live X ingestion · scraping
follower analytics · token analytics · wallet · payments · comments · voting
localization · advanced search · network graphs · complex charts
```

---

## 8. Data constraints that shape the product

The maintainer has **no access to private LayoffHedge analytics**. The site must never claim
total impressions, profile visits, private X analytics, conversion, geography or follower
history, unless the official team supplies them (and then labelled as first-party).

V1 data is entered manually into JSON, validated, and built statically. This is intentional:

```text
manual first → stable schema → useful dataset → proven site → automation later
```

---

## 9. Verification model

Statuses: `verified`, `needs_review`, `archived`. Only `verified` (and non-placeholder)
records feed public headline metrics. "Verified" means *the maintainer checked that the public
source supports the record* — not verified by X, audited, or endorsed by LayoffHedge.
Methodology must say this explicitly.

---

## 10. Information architecture

```text
/              homepage — the narrative
/archive       full viral post archive — exploration
/evidence      browsable source ledger — verification
/methodology   definitions and calculation rules — trust
/about         independence and purpose — context
```

Optional later: `/amplified`, `/references`, `/timeline`.
The homepage tells the story; dedicated pages provide depth. The homepage is not a database browser.

---

## 11. User journeys

**Visitor:** thesis → big metric → supporting metrics → crossover → amplifiers → viral posts →
media references → evidence → understands every claim is checkable.

**Researcher:** open site → archive or evidence → inspect record → open original source →
see observation date → read methodology → open repository.

**Contributor:** find repo → read contribution instructions → edit the right JSON →
attach evidence → run validation → open PR.

---

## 12. Success criteria for V1

**Product** — thesis understood in ~10 seconds; metrics readable; sources inspectable; crossover clear.
**Design** — visually distinctive; relates to LayoffHedge without impersonating; not a crypto landing
page; mobile strong.
**Data** — all headline metrics derived; every production record sourced; model extensible.
**Engineering** — no backend; fast; simple updates; straightforward deploy; understandable repo.

Launch gate: homepage visually complete · core data populated · metrics correct · all visible
records sourced · mobile polished · methodology exists · disclaimer visible · repo public ·
contribution instructions exist · **no placeholder metrics in production**.

A perfect dataset is not required. A credible dataset is.

---

## 13. Content minimums before public launch

```text
posts           10–20 strong tracked posts   (currently 20 ✔)
amplifications  5–10 verified examples       (currently 9, 5 verified)
media           5–10 verified references     (currently 0 — section must stay hidden)
```

If a category lacks data, **omit the section** rather than fill it weakly.
Ten credible records beat fifty poorly sourced ones.

---

## 14. Token positioning

Optional in V1, small, late on the page, factual:

```text
THE MOVEMENT
ALSO HAS A TOKEN.

$LAYOFF

Attention came first.
```

Never: price, market cap, FDV, predictions, buy CTA, return claims, urgency.

---

## 15. Feature decision framework

Before adding anything, ask:

```text
Does this help demonstrate attention?
Does this help demonstrate crossover?
Does this improve verification?
Does this improve contribution?
```

All four "no" → defer it.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Looks official | strong independence disclosure, separate identity, no misleading logo use |
| Looks like token promotion | token late or absent, no price data, evidence-first copy |
| Weak data → weak narrative | launch only sections with enough evidence; data-driven section visibility |
| Fake precision | observed values, observation dates, published methodology |
| Over-engineering | static JSON, no backend, automation later |

---

## 17. SEO positioning

Target descriptive queries: LayoffHedge, LayoffAI, viral posts, media coverage, public reach,
attention, references. Keep it factual; avoid speculative token SEO.

---

## 18. Legal / reputation guardrails

Never imply official affiliation, brand ownership, endorsement, financial advice, guaranteed
token value, or privileged data access. Use screenshots, logos and public content only where
useful for identification, evidence or commentary.

---

## 19. Product principles

```text
Evidence over hype.
Attention over token mechanics.
Public data over private assumptions.
Simple metrics over fake sophistication.
Editorial clarity over dashboard density.
Manual accuracy before automation.
Open source with review, not uncontrolled editing.
```
