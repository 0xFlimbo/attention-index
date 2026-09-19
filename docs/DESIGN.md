# DESIGN.md

Owns: visual identity, tokens, typography, layout, component styling, motion, accessibility.
(Consolidated from `DESIGN_SYSTEM.md`, kept in `docs/archive/`.)

Visual references: `references/visual/*.jpg` — warm cream, near-black type, selective warm red,
large editorial headlines, thin rules, simple infographics. They are direction, not shippable assets.

---

## 1. Visual hierarchy

```text
1. Typography
2. Data
3. Evidence
4. Layout
5. Motion
6. Decoration (last)
```

Every visual decision should communicate one of: attention, scale, crossover, credibility, verification.

Mental model: **would this look credible printed in a serious data magazine?**
If it looks like a crypto presale page, reject it.

---

## 2. Brand relationship

May borrow: warm cream backgrounds, near-black type, warm red accent, large editorial headlines,
thin dividers, poster composition, clear source attribution, simple charts.

Must not: copy the official homepage layout, impersonate the brand, imply endorsement, or
reproduce branded assets misleadingly.

---

## 3. Color tokens

```css
:root {
  --color-bg: #F2EFE9;
  --color-bg-soft: #F7F4EF;
  --color-surface: #F3F0EA;

  --color-ink: #171717;
  --color-ink-soft: #5F5B56;
  --color-ink-muted: #7A756F;

  --color-accent: #E34B46;
  --color-accent-ink: #C0322D;

  --color-line: #DDD7CF;
  --color-line-strong: #CFC8BE;

  --color-panel-dark: #1E1E1E;
  --color-panel-dark-text: #F3F0EA;

  --color-compare-blue: #3E5F9E;
}
```

Values are an initial approximation and may be tuned — **tune the token, never a component**.

**Roles**

- **Cream** — page background, large sections, data grids, archives, editorial blocks. Avoid pure white.
- **Near-black** — headlines, body, labels, numbers unless highlighted. Avoid as default page background.
- **Red** — key numbers, one highlighted phrase per headline, eyebrows, thin rules, selected chart
  values, section transitions. Used sparingly. Two tokens, split by role: `--color-accent` for
  display-size text, the red narrative background, rules and the focus outline; `--color-accent-ink`
  for red at small text sizes on cream only — see §11.
- **Blue** — *only* a second comparison series in data viz. Never navigation, brand, button or decoration.

Target balance ≈ **75% cream / 20% near-black / 5% red**. Red must never become background noise.

Dark surfaces are allowed only as rare, deliberate editorial interruptions (e.g. the evidence panel).

---

## 4. Typography

**Manrope** — headlines, body, statistics, navigation, labels, buttons.
**IBM Plex Mono** — timestamps, source metadata, IDs, technical/archive labels. Never long paragraphs.

Load via `next/font`, only the weights actually used.

```css
font-family: "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Scale (desktop reference)

```css
--text-xs: 12px;  --text-sm: 14px;  --text-base: 18px;
--text-lg: 24px;  --text-xl: 32px;  --text-2xl: 48px;
--text-3xl: 72px; --text-4xl: 96px; --text-5xl: 128px;
```

```css
/* hero */        font-size: clamp(64px, 10vw, 160px); line-height: .88; font-weight: 700; letter-spacing: -.05em;
/* large stat */  font-size: clamp(56px, 7vw, 112px);  line-height: .9;  font-weight: 700; letter-spacing: -.04em;
/* body */        font-size: clamp(18px, 1.5vw, 24px); line-height: 1.35;
/* metadata */    font-size: 12px; line-height: 1.4; letter-spacing: .06em; text-transform: uppercase;
/* record id */   font-size: 12px; line-height: 1.4; letter-spacing: .06em;   /* metadata, NOT uppercased */
```

`record id` (`.text-record-id`, added in B5) is the metadata scale with the uppercasing removed,
paired with the mono stack wherever a record's `id` is printed verbatim — today `/evidence`.
It also carries any other metadata-scale value whose exact casing is part of the value: B6 uses it
for `official_x_account` on `/about`, where the surrounding `.text-metadata` list would otherwise
inherit `@LayoffAI` down to `@LAYOFFAI`, a handle that is not the account's name. That case is why
the class sets `text-transform: none` **explicitly** rather than just leaving it unset: on
`/evidence` it replaces `.text-metadata` on the same element, so omission was enough, but as a
child of a `.text-metadata` element an unset property inherits the ancestor's `uppercase`. Caught
at the B6 visual review, after a first fix that applied the class and assumed that was sufficient.
It is **not** an inline-code style: inside body prose (18–24px) its 12px would render a field name
at half the size of the text around it, so `/methodology` uses the bare `font-mono` utility there.
`docs/DATA.md §2` defines ids as lowercase, and an id transformed on screen is one a reader cannot
copy into `data/*.json` and find. It is a separate class rather than `.text-metadata` plus a
`normal-case` utility because the component classes in `globals.css` sit outside Tailwind's cascade
layers and therefore outrank every utility in `@layer utilities`.

### Mobile

```css
/* hero */       font-size: clamp(52px, 15vw, 88px); line-height: .9;
/* large stat */ font-size: clamp(48px, 13vw, 72px);
/* body */       font-size: 18px;
```

Mobile stays a poster, never a compressed desktop dashboard.

### Character

Large, dense, confident, editorial, left-aligned, asymmetric when useful.
Never generic centered landing-page typography.

```text
good:  ATTENTION / IS THE / ASSET.
bad:   Welcome to the LayoffHedge Attention Dashboard
```

### Headline highlight

One phrase per headline may be red, and the red must carry meaning:

```text
ATTENTION IS THE [ASSET.]          THE ATTENTION DIDN'T STAY [INSIDE CRYPTO.]
```

No rainbow emphasis, no gradient text, no multiple unrelated highlights.

---

## 5. Spacing, grid, borders, radius, shadows

```css
--space-1:4px; --space-2:8px;  --space-3:12px; --space-4:16px; --space-5:24px; --space-6:32px;
--space-7:48px; --space-8:64px; --space-9:96px; --space-10:128px; --space-11:160px;
```

Section padding: desktop `120px` block · large narrative `160px` · mobile `72px`.

Container: `max-width: 1440px; margin-inline: auto; padding-inline: 32px;` (mobile `20px`).
12-column editorial grid on desktop; large display sections may deliberately break the grid.
Avoid narrow centered content columns for key sections — the site should feel broad and spatial.

```css
--radius-none: 0; --radius-sm: 6px; --radius-md: 12px; --radius-lg: 18px;  /* default card: 6px */
```

Borders do the work shadows would: `1px solid var(--color-line)`, strong `--color-line-strong`,
accent `--color-accent`. Default `box-shadow: none` — shadows only for sticky nav separation,
overlays and dialogs. Never `border-radius: 24px / 32px / 9999px` except tiny pills.

Banned outright: glassmorphism, neon glow, crypto/rainbow gradients, blurred blobs, 3D spheres,
floating coins, futuristic grid backgrounds, cyberpunk fonts, particle effects, animated noise,
generic analytics cards, giant CTA buttons, fake testimonials, decorative charts, price widgets.

---

## 6. Core components

### Section eyebrow

```text
01 / ATTENTION   02 / CROSSOVER   03 / AMPLIFIED
04 / VIRAL ARCHIVE   05 / PUBLIC REFERENCES   06 / EVIDENCE
```

```css
font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent);
```

### Thin red rule
A 4px red top rule on the hero, a red footer rule or a red section delimiter is on-brand.
Do not scatter thick red borders everywhere.

### Stat grid

```text
┌──────────────────────┬──────────────────────┐
│ 42                   │ 8                    │
│ POSTS ABOVE 1M       │ POSTS ABOVE 5M       │
├──────────────────────┼──────────────────────┤
│ 18.7M                │ 137.4M               │
│ MOST VIEWED POST     │ OBSERVED VIEWS       │
└──────────────────────┴──────────────────────┘
```

Flat, thin borders, no shadows, large number + small label, red on selected values only.
Hover may shift the surface color slightly — no lift effect.
Desktop 2×2 (or 4-across); mobile 1 column, 2×2 only when labels stay comfortably readable.

Stat value: `font-weight:700; letter-spacing:-.04em; font-size: clamp(48px, 6vw, 96px);`

### Poster callout
Light (`--color-bg-soft` + line), red-bordered (`--color-bg` + accent border), or dark
(`--color-panel-dark`). For crossover statements, evidence blocks, big aggregates.

### Archive row

```text
01    18.7M    AMAZON LAYOFFS       AUG 24 2026     ↗
02    12.1M    META                 JUL 03 2026     ↗
```

Full-width lines, generous row height, strong typography, visible source link, no card per row.
Optional desktop hover preview; mobile taps to expand inline.

### Media reference row

One row per publication (`MediaReferenceRow`, added B8), same flat/full-width/`border-b
border-line`/no-card contract as the archive row above. Summary line: publication name plus its
derived reference count (`N references` / `1 reference`). A native `<details>` expansion lists
each eligible reference with its title, reference-type label, `published_at`, author and context
when present, and its own `VIEW SOURCE ↗` link — deliberately no link on the summary line itself,
since a publication with several references has no single correct destination for a row-level
glyph. Reuses `ArchiveRow`'s `.archive-row` / `.archive-row-toggle` CSS.

Each reference inside the panel carries its record id as its element id, so a single reference is
linkable on its own (`/#media-newsweek-2026-08-12`) — the same id `/evidence` prints verbatim.
`.media-reference-entry` gives those targets the sticky-nav scroll offset `section[id]` already
gets.

### Closing line

The homepage coda (`ClosingLine`, added B15 — `docs/HOMEPAGE.md §13`). Cream, `container-editorial
section-padding`, no new device: a section-register heading, one body paragraph at `max-w-prose`,
and a single `.text-metadata` external CTA. Deliberately **not** a poster callout and **not** the
red block — the full red device is capped at 1–2 uses per page and the Narrative Break has spent
it — and deliberately without a section eyebrow, since the eyebrow list above is closed at
`01`–`06` and this is a coda rather than a data section. No motion.

### Source footer

```text
────
Sources: X, Reuters, official filing
Observed: Sep 14, 2026
```

Small, muted ink, short red rule above, no clutter. Credibility component — use it often.

### Person / amplifier card
Text-first; portraits optional and the component must look complete without one.

```text
NAME SURNAME
U.S. SENATOR

REPOSTED @LAYOFFAI
18 MAY 2026

VIEW EVIDENCE ↗
```

### Buttons and links

```css
/* primary */   background: var(--color-ink); color: var(--color-bg); border-radius: 6px;
/* secondary */ background: transparent; border: 1px solid var(--color-ink); color: var(--color-ink);
```

Accent buttons are rare. External links are uppercase, small, bold, underline on hover:
`VIEW SOURCE ↗` · `VIEW ORIGINAL ↗` · `GITHUB ↗`. Prefer the `↗` glyph over icon clutter.

### Navigation

```text
LAYOFFHEDGE / ATTENTION INDEX          ATTENTION  CROSSOVER  ARCHIVE  SOURCES  GITHUB ↗
```

Sticky, ~64–72px, cream, thin bottom border. No floating navbar, no glass card, no pill nav,
no large logo, no competing CTA. Sticky state may add a very light `backdrop-filter: blur(8px)`.
Mobile: `LH / ATTENTION INDEX     MENU` opening a simple drawer or full-screen panel.

### Prose section

The titled section of a long-form prose page (`/methodology`, `/about`) — `ProseSection`,
added in B6. Below `lg` it is a heading stacked above its body. From `lg` up it becomes a
side-head on the §5 twelve-column grid: heading in columns 1–4, body in 5–11, twelfth column
left as trailing margin. Both pages had shipped their prose hard-left in a ~870px column
against 1440, the "narrow column beside a void" §5 rules out and the same defect corrected at
the B2 hero, the B4 Crossover diagram and the B5 Evidence panel and footer.

The body takes seven columns rather than eight on purpose: at eight it is ~904px, wide enough
that the children's `max-w-prose` stops binding (65 `ch`, and `ch` measures the wide `0`), and
lines ran ~85 characters on a page whose only job is being read. Seven returns the measure to
the mid-70s. The first child's top margin is zeroed at `lg` only, so the side-head and the first
paragraph share a baseline there while the stacked layout keeps its heading-to-body gap.

### Required custom components

```text
Navigation · HeroStatement · SectionEyebrow · PrimaryAttentionMetric · StatGrid · StatCell
NarrativeBreak · PosterCallout · CrossoverMap · AmplifierCard · ViralArchive · ArchiveRow
MediaReferenceRow · EvidenceBlock · SourceFooter · TokenSection · Footer · ProseSection
```

---

## 7. Data visualization

Simple only: horizontal bar, vertical bar, timeline, categorical counts.
Banned: radar, 3D, dense dashboards, decorative viz; donut only if unavoidable.

```text
primary series   var(--color-accent)
comparison       var(--color-compare-blue)
track/background var(--color-surface)
```

Bar chart style: large text labels, value shown directly, minimal axes, source beneath.

```text
Women     ███████████████████    +495K
Men       ██████                 +108K
```

Crossover visual: semantic layout + simple SVG connectors + category counts + real examples.
No force-directed graph, no D3. Always provide an accessible text equivalent.

---

## 8. Motion

Editorial, not playful. Static composition must be correct **before** any motion is added.

Allowed: fade, slide, reveal, one-time number count, thin line draw, staggered text blocks,
scroll-triggered section entry, subtle hover transition.

Banned: bouncing, wobbling, spring-heavy UI, perpetual motion, glowing pulses, floating blobs,
parallax overload, ambient decoration.

```css
fast: 180ms;  base: 320ms;  slow: 600ms;
easing: cubic-bezier(0.22, 1, 0.36, 1);
```

**Visible base state.** No element may sit at `opacity: 0`, `stroke-dashoffset: 1` or any other
hidden base state waiting for an animation to reveal it. Animate `transform` instead, so the
content is legible from the first frame and stays legible if the animation never runs. This is the
same rule as "comprehension must never depend on motion", applied to the CSS rather than to the
reduced-motion query (maintainer decision, 2026-09-18).

**Count what the visitor can see.** A mount-triggered animation on a section below the first
viewport has finished before anyone scrolls to it: it costs a hidden base state and returns
nothing. Either give it a real scroll trigger or remove it. At B9 the section reveal and the
Crossover line draw were removed on exactly this ground, taking the homepage motion budget from
five effects to three: the staggered hero line reveal, the one-time number count, and the mobile
nav panel transition.

**Number ticker** — runs once on viewport entry, 1.2–1.8s, no rerun, no casino rolling,
final value static.
**Marquee** — at most one per page, slow, minimal, only for real publication/amplifier names.

### Reduced motion
Under `@media (prefers-reduced-motion: reduce)` (and runtime checks where needed):
content stays fully visible, no information disappears, counts become static, scroll reveals
and line travel are disabled, layout stays complete. Comprehension must never depend on motion.

---

## 9. Imagery

No generic stock photography. Images are supporting evidence: source screenshots, public post
previews, article screenshots where appropriate, logos where needed, portraits only if useful
and correctly sourced. The site must work fully without any images.
Prefer local `.webp`/`.avif` assets over fragile hotlinked social images.

---

## 10. Responsive

Breakpoints `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`.
Design deliberately for **390 / 768 / 1440** and review every visual checkpoint at all three.

Mobile rules: keep oversized typography, stack data vertically, increase row spacing, drop
non-essential hover, convert hover previews to tap/expand, keep sources visible, no horizontal overflow.

Desktop-only hover behavior must always have a mobile equivalent. Never hide evidence behind hover.

---

## 11. Accessibility

WCAG 2.2 AA where practical: semantic HTML and heading order, keyboard navigation, visible focus,
sufficient contrast, descriptive link text, alt text for informative images (`alt=""` for decoration),
reduced motion, adequate touch targets, and **no color-only meaning** — if red marks importance,
text must say so too.

```css
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
```

Never remove outlines without a replacement. Accessibility is not traded for minimalism.

**Measured contrast against `--color-bg` (#F2EFE9):** `--color-ink` 15.62:1 · `--color-ink-soft`
5.87:1 · `--color-ink-muted` 3.98:1 · `--color-accent` 3.41:1 (and cream on accent, 3.41:1) ·
`--color-accent-ink` 4.90:1.

Only `ink`, `ink-soft` and `accent-ink` clear AA for normal text (4.5:1). `ink-muted` and `accent`
clear the large-text bar (3:1) only, so neither may carry metadata-scale (12px) or other small
copy — use `ink-soft`, or `accent-ink` when that small copy has to be red. Inside the red
narrative block, every string stays at large-text size (≥24px, or ≥18.66px bold).

**Resolved at B9 (maintainer decision, 2026-09-18): two reds, split by role.** The B2 checkpoint
had accepted the section eyebrow (§6: 13px/700 in `--color-accent`, 3.41:1) as a deliberate
exception. The B9 audit found the same failure a second time, undocumented, on the navigation's
`hover:text-accent` at `.text-metadata` size (12px), and found that the single-token fix this
section used to propose does not work: **#C0322D measures 4.90:1 on cream but only 2.97:1 on
`--color-panel-dark` (#1E1E1E)**, where `--color-accent` currently sits at 4.26:1 and carries
`VERIFY THEM.`. The two surfaces pull opposite ways — cream wants a darker red, the dark panel a
lighter one — and a scan at constant hue and saturation leaves a feasible window only two points
of lightness wide (#CC241F–#D02520), with under 3% margin on either side. Too tight to ship.

So the red is split rather than moved. `--color-accent` (#E34B46) keeps every use that needs 3:1
rather than 4.5:1 — display-size text, the red narrative background, thin rules, the focus outline
— including the one use on the dark panel. `--color-accent-ink` (#C0322D, 4.90:1) carries red at
small text sizes on cream: the section eyebrow and the navigation hover, and nothing else. It must
never be used on `--color-panel-dark`. `--color-accent-dark` and `--color-accent-soft` were dead
tokens, never referenced by any component; the first became `--color-accent-ink`, the second was
deleted.

---

## 12. Component library policy

`shadcn/ui` for interaction primitives only: Dialog, Sheet/Drawer, Tabs, Tooltip, Accordion, Button.
Never its default card styling as the visual identity. Core editorial components are custom-built.

`Magic UI` possibilities: Number Ticker, Marquee, Animated Beam — only if they beat a small custom
component, and stripped of all demo gradients and styling.

Any imported component must match this system's colors, spacing, radii, typography and motion
philosophy before it ships.

---

## 13. Final design test

- Does typography dominate?
- Is red selective and meaningful?
- Is cream the dominant canvas?
- Are sources visible?
- Are cards flat and borders doing the work?
- Is the layout editorial rather than app-like?
- Does the page still look complete with animation disabled?
- Is it credible without mentioning the token?
- Is it immediately obvious the project is independent?

Any "no" → revise before shipping.
