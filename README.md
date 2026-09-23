# LayoffHedge Attention Index

An open-source, source-linked record of the public attention, amplification and real-world
crossover of LayoffHedge.

> **Independent community project. Not affiliated with or endorsed by LayoffHedge.**

**Live site: <https://attention-index-theta.vercel.app>**

![Open Graph image for the LayoffHedge Attention Index, showing the site's title on the cream, black and red design system](https://attention-index-theta.vercel.app/opengraph-image)

[![CI](https://github.com/0xFlimbo/attention-index/actions/workflows/ci.yml/badge.svg)](https://github.com/0xFlimbo/attention-index/actions/workflows/ci.yml)

---

## What it shows

- How far @LayoffAI's posts travelled, as observed public view counts on the posts the dataset
  tracks.
- Which public people and organizations amplified those posts — reposts, quote posts, mentions,
  citations, interviews — each with a link to the act itself.
- Which publications referenced the project, and in how many countries.

Every figure the site shows is **derived** from the records in `data/` at build time, never typed
in, and every record behind it links to the public post or article it describes.

## How it works

> **Store the evidence. Derive the number. Show the source.**

Records live in local JSON, validated against a schema, then reduced to headline metrics by pure
functions and rendered as a static site. No database, no CMS, no server-side state. Only records
marked `status: "verified"` — and never a placeholder — feed a public metric.

## Quick start

```bash
corepack enable pnpm
pnpm install
pnpm dev            # http://localhost:3000
```

No database, no API key and no environment file are needed to run the site.

## Data

```text
data/posts.json           tracked @LayoffAI posts and observed public metrics
data/amplifications.json  public people and organizations that amplified the content
data/media.json           external media and public references
data/project.json         project metadata (links, disclaimer, methodology version)
```

Licensed CC BY 4.0 ([data/LICENSE](data/LICENSE)). JSON Schemas for all four files live in
[data/schemas/](data/schemas/), so the JSON can be validated without TypeScript.

## Status

Version 1.0 — complete and maintained by hand. Data is refreshed occasionally, not on a fixed
schedule; the site prints the date its view counts were read and the date its data last changed,
so a reader can always tell how current it is.

## Contributing

Find a missing or incorrect record → edit the right JSON file → attach public evidence →
run `pnpm validate:data` → open a pull request. Contributions without a public source are not
merged. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, or
[open an issue](https://github.com/0xFlimbo/attention-index/issues/new/choose) to correct or propose
a record without editing it yourself.

## Documentation

These are the specifications the site is built to — the product contract, in the order a
newcomer would read them.

| File | Contents |
|---|---|
| [docs/USING.md](docs/USING.md) | **start here** — running it, verifying a number, the tools, forking it |
| [docs/PRODUCT.md](docs/PRODUCT.md) | thesis, scope, audience, routes, success criteria |
| [docs/DESIGN.md](docs/DESIGN.md) | tokens, typography, components, motion, accessibility |
| [docs/HOMEPAGE.md](docs/HOMEPAGE.md) | homepage sections and approved copy |
| [docs/DATA.md](docs/DATA.md) | JSON contract, validation rules, derived metrics |
| [docs/ENGINEERING.md](docs/ENGINEERING.md) | architecture, scripts, testing, CI, deployment |
| [docs/EDITORIAL.md](docs/EDITORIAL.md) | voice, metric labels, neutrality rules |
| [docs/TOOLS.md](docs/TOOLS.md) | the maintenance tools — commands, cost, what each writes |
| [docs/PROVIDERS.md](docs/PROVIDERS.md) | the paid data vendors — pricing, billing behaviour, traps |

## License

| Part | License |
|---|---|
| Code, configuration, scripts, documentation | MIT — [LICENSE](LICENSE) |
| The dataset in `data/` (the four `.json` files) | CC BY 4.0 — [data/LICENSE](data/LICENSE) |
| The JSON Schemas in `data/schemas/`, generated from the code | MIT — [LICENSE](LICENSE) |

Neither license covers the third-party material the records link to, and neither extends to any
third-party name, trademark, logo or content referenced or linked by this repository. This is an
independent community project, not affiliated with or endorsed by LayoffHedge.

Attribution for the dataset:
`LayoffHedge Attention Index — https://github.com/0xFlimbo/attention-index — CC BY 4.0`.
