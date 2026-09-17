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
10 Token (optional, omit in V1)
11 Footer
```

Build order differs from display order — see `docs/WORKPLAN.md`.

Anchors: `#top #attention #crossover #amplified #archive #references #evidence`.

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
| Public References | ≥1 verified media record (**currently 0 → section hidden**) |
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

LAST UPDATED [DATE]        SOURCE DATA ↗        METHODOLOGY ↗
```

Mostly empty section built around one very large derived number (`totalObservedViews`) and
`trackedPostCount`. Values come from the metrics layer — never hardcoded in JSX.

Label is exactly `OBSERVED VIEWS` / `OBSERVED VIEWS ACROSS TRACKED POSTS`. Never "impressions" or "reach".

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

## 11. Public References (08) — hidden until media data exists

```text
05 / PUBLIC REFERENCES

IT DIDN'T
STOP AT X.

Documented references across publications, journalism,
broadcasts, research, and other public sources.
```

Preferred rows, with counts derived per publication:

```text
FORBES                    3 references                  ↗
NEWSWEEK                  2 references                  ↗
```

Click may expand article title, date, URL and context. Never a wall of logos as the only content.
At most one slow marquee of real publication names, and only if enough recognizable ones exist.

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

`VERIFY THEM.` in red. Dataset summary with derived counts:

```text
POST DATA            20 records        VIEW ↗
AMPLIFICATIONS        9 records        VIEW ↗
MEDIA                 0 records        VIEW ↗
MILESTONES            0 records        VIEW ↗
```

CTAs: `VIEW DATA ↗ · VIEW SOURCES ↗ · VIEW METHODOLOGY ↗ · GITHUB ↗`.
Treatment: **dark panel inside a cream section** (`--color-panel-dark`) — contrast without a dark site.

---

## 13. Token (10) — omitted in V1

If enabled later: small, late, factual.

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
non-null, and `DATA` points at `/archive` until a repository exists — see `docs/WORKPLAN.md`,
"Decisions already made".

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
