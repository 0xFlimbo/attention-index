# LayoffHedge Attention Index

An independent, open-source record of the public attention, amplification and real-world crossover
of LayoffHedge, built from publicly verifiable data.

> **Independent community project. Not affiliated with or endorsed by LayoffHedge.**

---

## Principle

> **Store the evidence. Derive the number. Show the source.**

Headline metrics are calculated from source records in `data/`, never stored as summaries.
Only records marked `status: "verified"` (and not placeholders) contribute to public metrics.
Public view counts are **observations** paired with an observation date — not unique people.

---

## Stack

`Next.js (App Router)` · `TypeScript` · `Tailwind CSS` · `Zod` · `Vitest` · `pnpm`.
Static-first: local JSON → validation → derived metrics → static build. No database, no CMS, no backend.

## Data

```text
data/posts.json           tracked @LayoffAI posts and observed public metrics
data/amplifications.json  public people and organizations that amplified the content
data/media.json           external media and public references
data/milestones.json      editorial milestones
data/project.json         project metadata (links, disclaimer, last update)
```

## Local development

```bash
corepack enable pnpm
pnpm install
pnpm dev            # http://localhost:3000
```

```bash
pnpm validate:data          # schema, IDs, dates, URLs, enums, references, evidence
pnpm check:production-data  # blocks placeholder data from shipping
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Optional maintenance tools (never part of the production runtime):
`pnpm enrich:twitter` (needs `X_BEARER_TOKEN` in `.env.local`) and `pnpm import:press`.

## Contributing

Find a missing or incorrect record → edit the right JSON file → attach public evidence →
run `pnpm validate:data` → open a pull request. Contributions without a public source are not merged.
See `CONTRIBUTING.md` for the full workflow, evidence requirements and id conventions.

## License

| Part | License |
|---|---|
| Code, configuration, scripts, documentation | MIT — `LICENSE` |
| The dataset in `data/` | CC BY 4.0 — `data/LICENSE` |

Neither license covers the third-party material the records link to, and neither extends to any
third-party name, trademark, logo or content referenced or linked by this repository. This is an
independent community project, not affiliated with or endorsed by LayoffHedge.

Attribution for the dataset:
`LayoffHedge Attention Index — https://github.com/0xFlimbo/attention-index — CC BY 4.0`.

## Documentation

These are the specifications the site is built to — the product contract, in the order a
newcomer would read them. Planning and working-process notes are kept out of this repository, so
a cross-reference to a file you cannot find here is one of those; nothing a contributor needs is
missing.

| File | Contents |
|---|---|
| `docs/PRODUCT.md` | thesis, scope, audience, routes, success criteria |
| `docs/DESIGN.md` | tokens, typography, components, motion, accessibility |
| `docs/HOMEPAGE.md` | homepage sections and approved copy |
| `docs/DATA.md` | JSON contract, validation rules, derived metrics |
| `docs/ENGINEERING.md` | architecture, scripts, testing, CI, deployment |
| `docs/EDITORIAL.md` | voice, metric labels, neutrality rules |
