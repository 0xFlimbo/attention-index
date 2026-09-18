# Contributing

This project's headline numbers are calculated from records in `data/*.json`, never hardcoded
and never stored as summaries — see `CLAUDE.md`'s canonical data rule: **store the evidence,
derive the number, show the source.** Contributing means adding or correcting a record, not
adding a number.

## Where to open a pull request

The repository is <https://github.com/0xFlimbo/attention-index>. Fork it, branch from `main`,
and open a pull request against `main`. The workflow below is live, not aspirational — it is also
exactly how the maintainer works locally.

## Which file to edit

| You have… | Edit | Prefix |
|---|---|---|
| A public post by @LayoffAI with a view count | `data/posts.json` | `post-` |
| A repost, quote post, reply, mention, citation or interview by a named person or organization | `data/amplifications.json` | `amp-` |
| An article, newsletter, podcast, broadcast or other external coverage | `data/media.json` | `media-` |
| A dated, notable event in the project's public attention (not itself a post or article) | `data/milestones.json` | `milestone-` |
| Project-wide metadata (official links, disclaimer, last-updated date) | `data/project.json` | — |

Read `docs/DATA.md` for the full schema of the file you're editing before you add a field —
it is the single owner of the data contract, and this file does not repeat it.

## Evidence requirements

A record cannot move to `status: "verified"` without evidence a stranger can check:

- **post** — `url` (the original public post), `metrics.views`, `metrics.observed_at` (the date
  you personally observed that view count — not the publish date).
- **amplification** — `evidence_url` (the public post, article or clip that shows the
  amplification happening).
- **media** — `url` (the article or reference itself).

Every `verified` record also needs `verified_at` — the date the evidence was checked. Store raw
values only: `"views": 18700000`, never `"18.7M"`; `"2026-09-15"`, never `"Sep 15, 2026"` —
formatting is a UI concern, never a data concern (`docs/DATA.md §2`).

If you're not confident a record is accurate, or evidence is indirect (for example, a citation
inside an embedded tweet rather than the article text), set `status: "needs_review"` rather than
`"verified"`. Records imported by an automated tool (`pnpm enrich:twitter`, `pnpm import:press`)
land at `needs_review` by default for the same reason — an import is not a verification.
Reviewed-and-confirmed records only ever move from `needs_review` to `verified` by hand.

Development fixtures must carry `"_placeholder": true` **and** `"status": "needs_review"`.
Placeholder records never ship as `verified` and must never reach production — `pnpm
check:production-data` fails the build if one does.

## ID conventions

Format: `category-descriptor-date` or `category-descriptor-tweetid`, lowercase, hyphenated,
stable once published (`docs/DATA.md §2`). Real examples from this dataset:

```text
post-layoffai-2099180586858393814
amp-harmeet-dhillon-2098925135302476136
media-newsbreak-2026-09-14
milestone-first-10m-post-2026-06-02
```

Don't reuse or renumber an id once it exists — other records (`related_post_id`) and external
links may already point at it. IDs must be unique within their own file.

## Local checks

Run all of these before proposing a change, in order:

```bash
pnpm validate:data
pnpm check:production-data
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm validate:data` checks schema conformance, unique ids, valid ISO dates and absolute URLs,
allowed enum values, required fields, non-negative numeric metrics, dangling `related_post_id`
references, required evidence on every `verified` record, and reports placeholder records
(`docs/DATA.md §12`). `pnpm check:production-data` additionally fails the build if a visible
placeholder remains, a headline metric would be computed from a non-verified record, or required
project metadata is missing.

## Pull request expectations

```text
identify file → add/update record → attach public evidence → normalize values
→ pnpm validate:data → pull request → review → merge → rebuild
```

**Pull requests with unsupported claims are not merged.** A public source is required for every
new or changed fact — no exceptions. For a correction to an existing record, describe:

```text
Record:    the record id
Reason:    why the current value is wrong
Old value: what it currently says
New value: what it should say
Evidence:  a public link supporting the new value
```

Git history is the audit trail for every correction — prefer `status: "archived"` over deleting a
record when its history matters (for example, a value that was once believed correct and later
corrected); delete only when a record was erroneous, a duplicate, or never valid.

## Licensing of contributions

By opening a pull request you agree that your contribution is licensed under the same terms as
the part of the repository it touches: **MIT** for code, configuration, scripts and documentation
(`LICENSE`), **CC BY 4.0** for the records in `data/` (`data/LICENSE`). Neither license extends to
the third-party material a record links to — that stays with whoever published it.

This project is independent of, and not affiliated with or endorsed by, LayoffHedge. See
`docs/EDITORIAL.md` for voice and neutrality rules that apply to any new description, label or
copy contributed alongside a record.
