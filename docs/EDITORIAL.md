# EDITORIAL.md

Owns: voice, metric labels, banned language, neutrality rules, alt text, CTA wording.
(Consolidated from `CONTENT_GUIDELINES.md`, kept in `docs/archive/`.
The section-by-section approved copy now lives in `docs/HOMEPAGE.md`.)

> **Make the claim specific. Show the number. Link the evidence. Avoid the hype.**

---

## 1. Voice

Direct · measured · confident · specific · concise · analytical · independent.
Never hyped, tribal, defensive, sales-driven, speculative, financially persuasive, meme-heavy or corporate.

Model: `STRONG HEADLINE + PRECISE SUPPORTING COPY + VISIBLE EVIDENCE`.
Do not weaken the headline unnecessarily. Do not make the supporting claim stronger than the evidence.

Short sentences. Concrete nouns and verbs.

```text
good: 42 tracked posts crossed 1M observed views.
bad:  LayoffHedge has achieved an incredible level of engagement across the social landscape.

good: The post showed 18.7M views when checked on Sep 15, 2026.
bad:  The post reached 18.7 million people.          ← not equivalent
```

Headlines are short, declarative and grounded by the section beneath them. One red phrase per
headline, carrying the conceptual emphasis. Periods are allowed for force; exclamation points are not
(default: zero). No emoji in the interface. No hashtags as decoration or navigation.

Uppercase is for large UI labels; body copy is sentence case. Never uppercase paragraphs.

---

## 2. Banned language

**Hype** — revolutionary · unstoppable · game-changing · the next big thing · 100x · mass adoption ·
changing the world · the future of media · the most important token · once-in-a-generation opportunity.

**Financial persuasion** — "this makes $LAYOFF undervalued" · "the market hasn't priced in the
attention" · "buy before the market notices" · "this token should be worth more". The site documents
attention; it never converts attention into a valuation.

**Possessive framing** — our token · our account · our team · our project · we reported · we published.
Use `LayoffHedge published`, `@LayoffAI posted`, `the official account shared`.

**First person** — avoid `we believe / we think / we know`. Use `the public record shows`,
`the tracked dataset contains`, `the available evidence documents`. First person is acceptable only in
About or contribution docs.

**Naming LayoffHedge's own work** — a media record's `cited_work` (`docs/DATA.md §7`) and every
sentence built on it describe a thing, never rate it: `the layoff data` · `the H-1B filings data` ·
`an investigation`. Banned: `flagship product` · `flagship investigation` · `their best-known tool` ·
`the headline dataset` — each is a judgement about which work matters, and this project makes none.
The construction is always a fact about a reference (`N references cite the H-1B filings data`),
never a claim about the work (`the H-1B data is their most cited product`).

Exception: a banned phrase may appear inside a clearly attributed quotation when materially relevant.

---

## 3. Metric labels

Labels describe exactly what was measured.

```text
approved:
OBSERVED VIEWS · OBSERVED VIEWS ACROSS TRACKED POSTS · TRACKED POSTS
POSTS ABOVE 1M · POSTS ABOVE 5M · POSTS ABOVE 10M · MOST VIEWED TRACKED POST
VERIFIED AMPLIFICATIONS · UNIQUE PUBLIC AMPLIFIERS
PUBLIC MEDIA REFERENCES · UNIQUE PUBLICATIONS

banned:
TOTAL REACH · TOTAL IMPRESSIONS · TOTAL PEOPLE REACHED · GLOBAL IMPACT
GLOBAL MEDIA IMPACT · MILLION-PERSON POSTS
```

Add a qualifier whenever ambiguity is possible (`OBSERVED VIEWS / ACROSS TRACKED POSTS`).

**"Observed" matters.** `18.7M observed views` = the public counter displayed ~18.7M when checked.
Not unique people, not a final lifetime count, not private analytics.

**Never equate views with people.** Not `137 million people saw LayoffHedge` — instead
`137M observed views across tracked posts`. Methodology explains that one person can view many posts.

**Attention vs influence** — `attention, reach, amplification, crossover, public visibility` are
observable. `influence, impact, power` imply changed decisions or behavior: use them only when
documented.

**"Viral"** is fine descriptively, but headline metrics stay quantitative
(`42 tracked posts above 1M views`, not `42 viral hits`).

**"Mainstream"** is subjective — prefer publication names or `publications outside crypto media`.
If used as a category, define it in methodology.

**"Crypto-native"** describes origin and audience — never as a pejorative. The point is crossover,
not superiority.

**"Movement"** is acceptable editorial framing; prefer `project` when the tone feels promotional.

---

## 4. Numbers and dates

```text
1.2K · 184K · 1M · 18.7M · 137.4M         max one decimal, trailing .0 dropped;
                                          no false precision (18.734829M)
42 POSTS ABOVE 1M                         exact integers for record counts; avoid "42+"
SEP 15 2026                               UI standard; long-form prose may use September 15, 2026
2026-09-15                                canonical JSON only
```

One date style per interface. Whenever a mutable metric is shown in detail, its observation date must
remain accessible (visible, in metadata, on tap, or on the detail page) — never lost.

```text
18.7M VIEWS
Observed Sep 15 2026
```

---

## 5. Record copy

**Post titles** — short, descriptive, neutral: `Amazon layoffs`, `Microsoft workforce cuts`.
Never sensational (`Amazon massacre`, `Meta's shocking collapse`), even if the source post is stronger.

**Post summaries** — 1–2 sentences, describe the subject, no dramatization, no interpretation unless needed.

**Attribute the claim to the post.** A summary reports what a post says; it never restates the
post's assertion as the site's own. Use `The post says …`, `The post describes …`,
`The post relays …`. This matters most where the post carries contested statistics or a charge
against a named party — the site's neutrality depends on the reader being able to tell whose claim
it is.

**Say when a post gives no source for its figures.** Where a post presents numeric claims with
**no attribution of any kind**, the summary ends with a plain statement of that fact — `The post
gives no source for the figures.` It is an observation about the post, not a judgement of it, and it
is the transparency the rest of the site asks of itself: a project built on `show the source` cannot
reproduce unsourced numbers silently.

The test is attribution, not citation quality, and it is deliberately narrow so that it can be
applied mechanically rather than by taste:

```text
no note:  names a source        — "Reuters got the memo", "the March jobs report"
no note:  credits an institution — "a federal jury found", "her own words to staff"
no note:  links out              — any URL in the post
no note:  attributes to itself   — "we've had Oracle on our tracker", "we're already tracking"
note:     figures and nothing else
```

Apply it consistently, never selectively — a caveat appearing only on posts the maintainer happens
to distrust is editorialising, which is the failure this rule exists to avoid in both directions. It
never applies to a post that makes no numeric claim. On the eleven posts added the day the rule was
adopted it fired exactly once. (Maintainer decision, 2026-09-19.)

**Amplification actions** — `REPOSTED · QUOTE-POSTED · MENTIONED · SHARED · CITED · INTERVIEWED`.
Never upgrade a weak interaction. A mention is not a repost; a repost is not an endorsement unless
the evidence clearly establishes one.

**Roles** — concise and accurate at the time of the event: `U.S. Senator`, `Journalist`,
`Founder & CEO`, `Technology reporter`. Names without honorifics: `Jane Doe`.

**Follower counts** — contextual only, always with observation date, never framed as people reached.

**Media context** — describe what happened, not what it supposedly proves.

```text
good: Cites LayoffHedge's layoff tracker.
good: References @LayoffAI reporting on Microsoft layoffs.
bad:  Forbes validates LayoffHedge.
bad:  Mainstream media confirms the movement's importance.
```

Publication and company names use their standard public form (`Forbes`, `Reuters`, `Microsoft`)
— and nothing else. A press page's `Inkl (via IBTimes UK)` packs a provenance fact into a name;
the name keeps `Inkl` and the fact moves to the record's own fields (`docs/DATA.md §7`).
Publication reference counts are derived, never asserted (`FORBES / 3 references`).

**Republications** are described as the fact they are, never as a lesser form of coverage:
`Republished from Western Journal`. The point of recording it is arithmetic, not judgement — one
piece and its republications are one piece of reporting (`docs/DATA.md §10`).

**Featured references** print their criterion, not the flag: `Names LayoffHedge as a source`.
Saying what was observed is both more informative than a label and harder to read as a ranking.
`FEATURED` as a badge word, and any star, icon or tier beside it, are out.

---

## 6. Neutrality rules

**Political figures** — record name, public role, action, date, source. Never add partisan
characterization, ideological judgement, motive, ranking, or the claim that a repost implies political
endorsement. Never use political records to influence electoral choices.

```text
good: Jane Doe / U.S. Senator / REPOSTED @LAYOFFAI / MAY 18 2026
bad:  Major political validation from Senator Jane Doe.
```

**Contested claims** — the site documents reach, amplification and citation. It does not automatically
validate the substantive claim inside a tracked post. Methodology should state:

```text
Inclusion in the archive documents public reach.
It does not independently verify every substantive claim contained inside the original post.
```

**Attribution** — always distinguish what the source says from what this site concludes. Attribute
journalists' interpretations; never adopt third-party promotional language as the site's own voice.
Quote sparingly and identify the source: `The publication described LayoffHedge as "…"`.

**Curation is declared, never disguised as measurement.** The `featured` flag is a rule this
project wrote and applies by hand, so `/methodology` states the rule in the reader's words and
says plainly that it is curation. It stays binary — no tiers, no score, no prestige number of the
project's own invention (`CLAUDE.md §3`) — and it changes position only. A publication that is
not featured is never described, or implied, to be a weaker source.

**Verification** — "verified" means the maintainer checked that the public source supports the record.
Not verified by X, not audited, not certified by LayoffHedge. `needs_review` records never appear as
verified facts and never in headline metrics.

**Corrections** — handled transparently through repository history, without defensive language:
`Data is periodically reviewed and corrected when stronger source information becomes available.`

---

## 7. Methodology tone

Plain and explicit. State limitations directly — they increase credibility.

```text
good: View counts are manually recorded from publicly visible X post counters.
      Because these counters change over time, each value is stored with an observation date.
bad:  Our proprietary methodology accurately captures true reach.
```

Required statements: observed views are not unique-user counts · the archive is manually curated and
may not contain every post · the project has no access to private account analytics · a repost is
amplification, not proof of endorsement.

---

## 8. Independence copy

```text
Independent community project.
Not affiliated with or endorsed by LayoffHedge.
```

Long form (About / Footer):

```text
This website is an independent community-built project based on publicly available
information. It is not operated by, affiliated with, or endorsed by LayoffHedge or @LayoffAI.
```

About page draft (refine later; do not invent biography):

```text
The LayoffHedge Attention Index is an independent community-built project that documents
the public reach and crossover of LayoffHedge using publicly available evidence.

It is not operated by or affiliated with LayoffHedge.

The project began from a simple observation: one of the most unusual parts of LayoffHedge
is not the existence of a crypto token, but the amount of attention the project has
generated outside crypto.

This site attempts to document that attention in a transparent, source-driven,
open-source format.
```

---

## 9. CTAs, links, states

```text
approved: VIEW SOURCE ↗ · VIEW ORIGINAL ↗ · VIEW EVIDENCE ↗ · SOURCE DATA ↗ · METHODOLOGY ↗
          OPEN RECORD ↗ · OPEN ARCHIVE ↗ · EXPLORE THE DATA ↗ · VIEW ON GITHUB ↗
          CONTRIBUTE DATA ↗ · SUBMIT A CORRECTION ↗
banned:   JOIN NOW · BUY NOW · DON'T MISS OUT · GET IN EARLY · BECOME PART OF THE REVOLUTION
avoid:    PROOF ↗   (prefer SOURCE / EVIDENCE)
```

**The glyph is not part of the label.** The list above fixes the *wording*; the arrow is chosen by
the destination, not by the phrase. `↗` marks a link that genuinely leaves the site and opens in a
new tab, and carries an `(opens in a new tab)` note for screen readers; an internal route takes `→`.
So `VIEW SOURCE`, `VIEW ORIGINAL`, `GITHUB`, `CONTRIBUTE DATA` and `SUBMIT A CORRECTION` are `↗`,
while `METHODOLOGY` and `OPEN ARCHIVE` are `→`, and a label like `SOURCE DATA` or `VIEW DATA` takes
whichever matches where it actually points that day — external once `project.json.repository_url`
is set, internal while it is `null`. Clarified at B9, where four labels had been shipped with `↗`
against internal routes because this list was read as prescribing the glyph.

Source labels: `Original X post`, `Public repost`, `Forbes article`, `Official LayoffHedge page`,
`YouTube interview`, `Public newsletter`. Never `Definitive proof`, `Verified truth`,
`Official confirmation` unless literally accurate.

Empty: `No verified records yet.` (optionally `Know of one? Submit a source.`) — never `Coming soon!!!`.
Loading (rare): `Loading records…`. Errors: `This source could not be opened.` /
`No records match this filter.` — concise, never blaming the user.

Archive filters use thresholds (`ALL · >1M · >5M · >10M`), never `MEGA VIRAL`.
Category labels stay stable and neutral: `GOVERNMENT · POLITICS · JOURNALISM · MEDIA · BUSINESS ·
TECH · PUBLIC FIGURES · OTHER`.

Link text must make sense out of context — `View original post`, never `Click here`.

Alt text is descriptive but short: `Screenshot of an @LayoffAI post showing the visible view count.`
Decorative assets use `alt=""`. Screenshot captions reinforce the snapshot nature:
`Public X post. View count shown as observed on Sep 15 2026.`

Avoid unnecessary jargon — a visitor should not need blockchain, DeFi or tokenomics knowledge.
Avoid unexplained crypto slang (CT, ape, bags, alpha) except when documenting source culture.

---

## 10. Content review checklist

- [ ] Is the claim supported by the data?
- [ ] Is the wording precise rather than promotional?
- [ ] Does the metric label describe the actual measurement?
- [ ] Is every mutable metric paired with an observation date?
- [ ] Is a source available and linked?
- [ ] Is attribution clear?
- [ ] Is political content neutral and free of inferred motive?
- [ ] Is a repost described as amplification rather than endorsement?
- [ ] Is there any token-price persuasion? (there must be none)
- [ ] Is the copy as short as it can be?
- [ ] Does it still work for a non-crypto visitor?

> The site should not ask visitors to believe that LayoffHedge matters.
> It should show them the record and let them judge.
