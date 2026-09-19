# HOMEPAGE.md

Owns: homepage structure, per-section layout/interaction, and the **approved copy deck**.
(Consolidated from `HOMEPAGE_SPEC.md` + the copy sections of `CONTENT_GUIDELINES.md`,
both kept in `docs/archive/`.)

The homepage is a **scroll-driven editorial story backed by verifiable data**, not a dashboard.

---

## 1. Section order (final)

```text
00 Navigation
01 Hero
02 Primary Attention Metric
03 Attention Grid
04 Narrative Break
05 Crossover
06 Amplified By
07 Viral Archive
08 Public References
09 Evidence / Sources
10 Closing line
11 Footer
```

Build order differs from display order — see `docs/WORKPLAN.md`.

Anchors: `#top #attention #crossover #amplified #archive #references #evidence #project`.

`#project` is the closing line (`§13`, B15). Like every other section anchor it exists for
deep-linking and for review captures, not for navigation — `§3` fixes the nav at five entries.

Rhythm rule: alternate large editorial statements → data blocks → archive/database views →
evidence blocks. Never "heading + four rounded cards" repeated down the page.

Layout: `max-width: 1440px; margin-inline: auto; padding-inline: 32px` (mobile `20px`),
background `var(--color-bg)`. Large narrative sections may break the grid.

Per-section copy hierarchy: `eyebrow → headline → short explanation → data → source/action`.

---

## 2. Section visibility is data-driven

A section must be able to disappear when the evidence is thin.

| Section | Renders when |
|---|---|
| Public References | ≥1 verified media record (**shipped in B8; 94 verified across 51 publications as of 2026-09-19, after B14 — the section renders and grows with the dataset, and B19 owns the row cap that growth now needs**) |
| Amplified By | enough verified amplifications for a real grid; otherwise fold examples into Crossover |
| Crossover | ≥1 verified amplification; categories only shown if they have records |
| Token | explicitly enabled; omitted in V1 |

Never render zeros or fake placeholders to fill space. Empty state copy: `No verified records yet.`

---

## 3. Navigation (00)

Desktop left `LAYOFFHEDGE / ATTENTION INDEX`, right `ATTENTION CROSSOVER ARCHIVE SOURCES GITHUB ↗`.
Sticky, ~64–72px, cream, thin bottom border, optional very light blur after scroll.
Mobile `LH / ATTENTION INDEX     MENU` → simple drawer/full-screen panel (shadcn Sheet allowed, restyled).
`GITHUB ↗` is hidden or disabled while `project.json.repository_url` is `null`.

---

## 4. Hero (01)

```text
UNOFFICIAL / INDEPENDENT COMMUNITY PROJECT

ATTENTION
IS THE
ASSET.

Tracking how LayoffHedge moved beyond crypto
and into public attention.

Public data. Public sources. Open source.

Independent community project. Not affiliated with or endorsed by LayoffHedge.
```

`ASSET.` in accent red. Left-aligned, 85–100vh, headline dominates, supporting copy below or
offset right, small metadata near the bottom, optional thin red top rule.

Motion: lines reveal sequentially with a small stagger; supporting text fades after the headline.
Never letter-by-letter, bouncing, 3D or parallax.

Never in the hero: token data, price, buy/wallet CTA, 3D artwork, video, crypto graphics.

Mobile keeps `clamp(52px, 15vw, 88px) / line-height .9` — it stays a poster.

---

## 5. Primary Attention Metric (02)

```text
[NUMBER]

OBSERVED VIEWS
ACROSS TRACKED POSTS

Across [N] publicly tracked posts

LAST UPDATED [DATE]        SOURCE DATA →        METHODOLOGY →
```

Mostly empty section built around one very large derived number (`totalObservedViews`) and
`trackedPostCount`. Values come from the metrics layer — never hardcoded in JSX.

Label is exactly `OBSERVED VIEWS` / `OBSERVED VIEWS ACROSS TRACKED POSTS`. Never "impressions" or "reach".

**`SOURCE DATA` / `METHODOLOGY` glyph, corrected at B9.** This section originally shipped both
with `↗`, copied verbatim from the sketch above before `docs/DESIGN.md §6` hardened into a
sitewide rule — established by `EvidenceBlock`, `ViralArchive` and `PublicReferences` — that `↗`
marks a genuinely external destination and `→` marks an internal route. `METHODOLOGY` always
resolves to `/methodology`, on this site, so it is `→`. `SOURCE DATA` follows `EvidenceBlock`'s
`VIEW DATA` exactly: `↗` to `${repository_url}/tree/main/data` once the repository is public,
falling back to an internal `→` to `/evidence` only while `repository_url` is `null`.

Motion: one count-up on viewport entry, 1.2–1.8s, once, static afterwards, disabled under
reduced motion. The static layout must look complete with animation off.

---

## 6. Attention Grid (03)

```text
01 / ATTENTION

HOW MUCH
ATTENTION?
```

Cells are **selected by data availability**, in this priority order, showing exactly four:

```text
1. POSTS ABOVE 1M            (if count > 0)
2. POSTS ABOVE 5M            (if count > 0)
3. POSTS ABOVE 10M           (if count > 0)
4. TRACKED POSTS             (always available)
5. MOST VIEWED TRACKED POST  (always available)
6. OBSERVED VIEWS ACROSS TRACKED POSTS (always available)
```

Rule: never render a threshold cell whose value is `0`. Fall through to the next available metric.
With the current dataset (20 posts, max 4.5M) the grid resolves to:
`POSTS ABOVE 1M · TRACKED POSTS · MOST VIEWED TRACKED POST · OBSERVED VIEWS`.

Desktop 2×2; mobile 1 column (2×2 only if labels stay comfortably readable).
Flat, border-led, low radius, no shadows, strongly typographic.
Hover may shift surface color and reveal source link / observation date — never a shadow lift,
and never hide the observation date on mobile.

---

## 7. Narrative Break (04)

First, on cream:

```text
VIEWS ARE
ONLY HALF
THE STORY.
```

Then, on a **full-width red section** (`background: var(--color-accent); color: var(--color-bg)`):

```text
THE ATTENTION
DIDN'T STAY
INSIDE CRYPTO.

POLITICS / MEDIA / JOURNALISM / BUSINESS / CULTURE
```

No cards, no particles, no extra content inside the red section. Large type, generous whitespace.
The full red device is used at most 1–2 times on the whole homepage.

This transition is the product thesis — treat it as a major visual moment.

---

## 8. Crossover (05)

```text
02 / CROSSOVER

FROM CRYPTO
TO CULTURE.

Publicly documented examples of LayoffHedge content
being amplified outside the crypto-native audience.
```

Categories come from `amplifications.json` (`government, politics, journalism, media, business,
tech, public_figure, other`) and are only shown when they have records.

Preferred visual: LayoffHedge in the center, categories around it, simple SVG connectors,
category counts, selected real examples, plus an accessible text equivalent below.

```text
                 POLITICS
                    12
                     │
MEDIA  ─────────  LAYOFFHEDGE  ─────────  BUSINESS
 18                                          9
                     │
               JOURNALISM
                    21
```

Desktop: hovering a category highlights its connections and reveals example names.
Mobile: stacked category blocks with counts and examples — no diagram, no horizontal overflow.
Motion: subtle line reveal only. No force simulation, no D3, no glowing beams.

---

## 9. Amplified By (06)

```text
03 / AMPLIFIED

WHO CARRIED
THE MESSAGE
FURTHER?
```

(Alternative if "message" reads promotional in context: `WHO CARRIED / THE CONTENT / FURTHER?`)

Text-first cards, portraits optional:

```text
NAME SURNAME
U.S. SENATOR

REPOSTED @LAYOFFAI
18 MAY 2026

VIEW EVIDENCE ↗
```

Fields supported: name, role, category, action, date, related LayoffHedge post, evidence URL,
optional portrait, optional follower count (always with its observation date).

Desktop 2–3 column editorial grid, thin separators, large whitespace, no profile-card styling.
Mobile 1 column, source link always visible.
Filters (`ALL / POLITICS / JOURNALISM / BUSINESS / OTHER`) only if there are enough records.

Political entries stay strictly factual — see `docs/EDITORIAL.md`.

---

## 10. Viral Archive (07)

```text
04 / VIRAL ARCHIVE

THE POSTS
THAT TRAVELLED.
```

Row structure `INDEX · VIEWS · SUBJECT · DATE · SOURCE`, sorted by views descending:

```text
01    18.7M    AMAZON LAYOFFS       AUG 24 2026     ↗
02    12.1M    META                 JUL 03 2026     ↗
```

Editorial database feel: flat full-width rows, no card per row, large row height, scannable.
Optional filters `ALL / >1M / >5M / >10M` — only thresholds that match real records.

Desktop: hovering a row may reveal preview/screenshot/likes/reposts/observation date in a
sticky preview area on the right. No modal per hover.
Mobile: tap expands inline with the same metadata and the source link.

The archive must remain readable and useful with JavaScript disabled.
The homepage shows the strongest rows; `/archive` shows all verified posts.

---

## 11. Public References (08) — shipped in B8

```text
05 / PUBLIC REFERENCES

IT DIDN'T
STOP AT X.

Documented references across publications, journalism,
broadcasts, research, and other public sources.
```

One flat row per publication (`MediaReferenceRow`), with the reference count derived, never
asserted:

```text
FORBES                    3 references
NEWSWEEK                  2 references
```

Each row is a native `<details>/<summary>` — keyboard-accessible, works without JavaScript, and
never hover-only on mobile. Expanding it lists every eligible reference for that publication with
its title, reference-type label, `published_at`, author when present, context when present, and
its own `VIEW SOURCE ↗` link. **No row-level `↗`**: a publication with more than one reference has
no single correct destination, so the link lives on each reference inside the panel instead of on
the summary line (a deviation from this section's original sketch above, made deliberately at B8 —
see `docs/WORKPLAN.md` "Decisions already made"). Never a wall of logos as the only content.

**No marquee.** The homepage's motion budget (`globals.css`) is deliberately exactly three effects,
and `CLAUDE.md` requires restrained motion; the marquee this section's spec originally allowed is
left to B9, which owns the motion audit, rather than added ad hoc here.

### B13 — prominence, without a badge

**Row order carries it.** Groups are ordered by five factual keys, owned by `docs/DATA.md §11`:
original reference count, featured reference count, total reference count, most recent
`published_at`, publication name. A publication that did its own reporting leads one that only
republished someone else's piece, and a featured publication leads the unfeatured ones it ties
with. Never a computed rank.

**The summary line is unchanged.** Publication name on the left, `N references` on the right,
same as B8. Nothing was added to that right rail: it is `shrink-0 whitespace-nowrap`, so
anything put there widens a fixed column and is the first thing to overflow at 390px.

**The panel states the facts in words.** Each reference's metadata line now reads
`<type> · <date> · By <author> · <newsroom country> · Republished from <outlet> · Names
LayoffHedge as a source`, with every part after the date omitted when it does not apply. No star,
no badge, no icon — `docs/DESIGN.md` has no decorative iconography anywhere in the system, and
the official press page's star is a press kit's grammar, which is the one thing an independent
index must not borrow. A featured reference prints its **criterion** rather than the word
"featured", which is more informative and reads as a fact instead of a rank.

**The section still has no figure of its own.** The B13 country and provenance metrics live on
`/methodology` and, per record, on `/evidence`; the standing decision that this section keeps no
dominant number (`docs/WORKPLAN.md`, "Decisions already made") was not reopened.

---

## 12. Evidence / Sources (09)

```text
06 / EVIDENCE

DON'T TRUST
THE NUMBERS.

VERIFY THEM.

Every major claim on this website links back to
publicly accessible evidence or source data.
```

`VERIFY THEM.` in red. One row per dataset, each count derived at build time:

```text
POST DATA            N records        VIEW →
AMPLIFICATIONS       N records        VIEW →
MEDIA                N records        VIEW →
```

Three rows, fixed in that order. No sample figures are printed here on purpose — the counts are
derived and `docs/DATA.md §10` owns both the selector contract and the one dated reading of it;
two copies of the same numbers is exactly how this section went stale before. A zero-count row
still renders, without its `VIEW` link (`docs/DATA.md §10`). `VIEW` is internal to
`/evidence#<key>`, so it renders with `→`, not `↗`.

CTAs: `VIEW DATA ↗ · VIEW SOURCES ↗ · VIEW METHODOLOGY ↗ · GITHUB ↗`.
`VIEW DATA ↗` resolves to `${repository_url}/tree/main/data` and `GITHUB ↗` to the repository
root; `VIEW SOURCES` and `VIEW METHODOLOGY` are internal and render with `→`.
Treatment: **dark panel inside a cream section** (`--color-panel-dark`) — contrast without a dark site.

---

## 13. Closing line (10) — shipped in B15

One factual statement and one link to the project this site measures, which until B15 was
reachable only from the footer and `/about`. Approved copy:

```text
ATTENTION CAME FIRST.

This site documents the public attention around LayoffHedge.
The project itself publishes at layoffhedge.com.

OFFICIAL LAYOFFHEDGE ↗
```

**It is information, not a recommendation.** No imperative verb, no community recruitment, no
token, no purchase path (`docs/WORKPLAN.md`, `Decisions already made` item (c)). "Join the
community" is an implied endorsement, which `CLAUDE.md §3` bans by name, and this site grows by
being cited rather than by converting readers. The second sentence says where the destination is;
it never suggests going there.

Three calls made at the B15 plan, with the maintainer:

- **`OFFICIAL LAYOFFHEDGE ↗`, not `OFFICIAL PROJECT ↗`.** The batch title used the latter, but
  the footer (`§14`) and `/about` already ship the former for this exact URL, and
  `docs/EDITORIAL.md §9` wants link text that survives out of context. One destination, one
  label — a third wording adds vocabulary and no information.
- **No disclaimer inside the block.** The hero (`§4`) carries `project.disclaimer` and the
  footer's long form sits immediately below this section, so the independence statement already
  brackets it on both sides. Re-examine if the section ever moves.
- **No section eyebrow.** This is a coda, not a section with data, and `docs/DESIGN.md §6` closes
  the eyebrow list at `01`–`06`.

Cream and typographic, no new visual device: `docs/DESIGN.md` allows the full red block at most
1–2 times on the homepage and `§7`'s Narrative Break has spent it. The heading sits in the
section-headline register (`text-2xl md:text-3xl`), not the hero's, so the hero stays the page's
dominant statement and the Primary Attention Metric stays its dominant number. No motion — the
homepage budget is exactly three effects and this adds none.

### If a token section is ever enabled

Kept here by the standing decision that `§13` holds this copy for later (`docs/WORKPLAN.md`,
`Decisions already made`). It is **not** shipped, and B15 did not revive it — the closing line
above deliberately takes only the one line of it that is a statement about attention.

```text
THE MOVEMENT
ALSO HAS A TOKEN.

$LAYOFF

Attention came first.

OFFICIAL PROJECT ↗
```

Never price, market cap, FDV, buy button, performance or return claims.

---

## 14. Footer (11)

```text
LAYOFFHEDGE ATTENTION INDEX

Independent community project built from public data.
Not affiliated with, operated by, or endorsed by LayoffHedge.

DATA   METHODOLOGY   GITHUB   SOURCES   ABOUT   OFFICIAL LAYOFFHEDGE ↗

LAST DATA UPDATE
SEP 16 2026
```

Cream or soft cream, thin top divider, optional red bottom rule, compact. No newsletter signup.
`LAST DATA UPDATE` reads `project.json.data_last_updated`.

`ABOUT` was added to this list at the B5 sign-off: §3 fixes the navigation at
`ATTENTION / CROSSOVER / ARCHIVE / SOURCES / GITHUB ↗`, so without it `/about` is a route with no
inbound link anywhere on the site. `GITHUB ↗` renders only while `project.json.repository_url` is
non-null. `DATA` is external and resolves to `${repository_url}/tree/main/data`, the raw records
themselves; it falls back to `/archive` only if `repository_url` is ever `null` again, which is
where it stood in from the B5 sign-off until the repository was published on 2026-09-18.

---

## 15. Responsive summary

**1440** full editorial grid · large hero · 2×2 stat grid · crossover diagram ·
archive + sticky preview split · multi-column amplifiers.
**768** moderately reduced headlines · wide content · 2×2 stat grid · simplified crossover ·
full-width archive · 2-column amplifiers.
**390** oversized headline character preserved · stacked metrics · no hover-only information ·
inline expansions · stacked crossover categories · 1-column amplifiers · sources always visible.

---

## 16. Performance and metadata

Minimal client JS, no unnecessary client components, lazy-load non-critical images, optimized
screenshots, no autoplay media, no WebGL, no heavy chart framework. Animation must not delay
first contentful paint.

```text
title:       LayoffHedge Attention Index — Independent Public Record
description: An independent, open-source record of LayoffHedge's public reach,
             viral posts, media references, and real-world amplification.
```

Open Graph artwork in cream/black/red editorial style — never token-first metadata.

---

## 17. Visual acceptance checklist

- [ ] Hero feels editorial, not SaaS
- [ ] Cream dominant, red selective, typography primary
- [ ] Sources visible and easy to reach
- [ ] No unsupported metric shown
- [ ] Page works without the token section
- [ ] Independence stated clearly
- [ ] All repeated content rendered from structured data
- [ ] Mobile intentionally designed at 390px
- [ ] No glassmorphism / crypto visuals / oversized rounded cards / decorative charts
- [ ] Reduced-motion mode visually complete
- [ ] Page still looks credible with all animation disabled
