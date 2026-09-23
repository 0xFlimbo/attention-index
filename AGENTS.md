# AGENTS.md

The LayoffHedge Attention Index: a static, source-linked website and dataset documenting the
public attention, amplification and media crossover of LayoffHedge. Independent community
project — not affiliated with or endorsed by LayoffHedge.

## Setup

```bash
corepack enable pnpm && pnpm install && pnpm dev   # http://localhost:3000
```

No database, API key or environment file is needed to run the site.

## Checks

```bash
pnpm validate:data && pnpm check:production-data && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Documentation

| Doc | Owns |
|---|---|
| `docs/USING.md` | what the site is, running it, verifying a number, the tools |
| `docs/PRODUCT.md` | thesis, scope, audience, routes |
| `docs/DESIGN.md` | tokens, typography, components, motion, accessibility |
| `docs/HOMEPAGE.md` | homepage sections and approved copy |
| `docs/DATA.md` | JSON contract, validation, derived metrics |
| `docs/ENGINEERING.md` | stack, repo structure, scripts, tests, CI, deploy |
| `docs/EDITORIAL.md` | voice, metric labels, banned language, neutrality |
| `docs/TOOLS.md` | the maintenance tools — commands, cost, what each writes |
| `docs/PROVIDERS.md` | the paid data vendors — pricing, billing behaviour, traps |

## Non-negotiables

- Derive metrics from `data/`, never store or hardcode a summary — `docs/DATA.md`.
- Only `status: "verified"`, non-placeholder records feed a public metric — `docs/DATA.md §3`.
- Precise metric labels, no hype, no banned wording, independence line on every page — `docs/EDITORIAL.md`.
- Match the existing design system; never a component library's default look — `docs/DESIGN.md`.
- No invented features or scores beyond what `docs/PRODUCT.md` specifies.
- Paid-API tools (`docs/TOOLS.md`, `docs/PROVIDERS.md`) must never run without the maintainer asking — they spend real money per request.

Code conventions and the contribution workflow are in `CONTRIBUTING.md`.
