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
  --color-accent-dark: #D63E39;
  --color-accent-soft: #F4D9D6;

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
  values, section transitions. Used sparingly.
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
```

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
(`--color-panel-dark`). For milestones, crossover statements, evidence blocks, big aggregates.

### Archive row

```text
01    18.7M    AMAZON LAYOFFS       AUG 24 2026     ↗
02    12.1M    META                 JUL 03 2026     ↗
```

Full-width lines, generous row height, strong typography, visible source link, no card per row.
Optional desktop hover preview; mobile taps to expand inline.

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

### Required custom components

```text
Navigation · HeroStatement · SectionEyebrow · PrimaryAttentionMetric · StatGrid · StatCell
NarrativeBreak · PosterCallout · CrossoverMap · AmplifierCard · ViralArchive · ArchiveRow
MediaReferenceRow · EvidenceBlock · SourceFooter · TokenSection · Footer
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
