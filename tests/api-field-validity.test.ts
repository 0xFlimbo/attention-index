/**
 * Every `*.fields` and `expansions` value our scripts send, validated against
 * the X API's own OpenAPI specification.
 *
 * ---------------------------------------------------------------------------
 * **Why this is a test and not a one-off check.**
 *
 * The X API does not reject a field name it does not recognise. Measured
 * 2026-09-21: `post.fields=referenced_posts` — a value valid for `expansions`
 * and not for `post.fields` — returned **HTTP 200 with `errors: []`** and simply
 * no such field. The request succeeds, the resources are billed, and the data
 * is quietly missing.
 *
 * That failure mode has already cost this project twice:
 *
 * - `note_post` was requested under `tweet.fields`, whose vocabulary calls it
 *   `note_tweet`. It was ignored, the full text of 34 posts was discarded, and
 *   the absence was written up as "the field is unpopulated on this tier". It
 *   was not: we were asking wrong. One maintainer decision was reversed when the
 *   text came back (`docs/X-API.md §13`).
 * - `expansions=referenced_tweets.id` in `enrich:twitter` was ignored for the
 *   same reason — the spec names it `referenced_posts`. Harmless only because
 *   nothing read the result.
 *
 * A human cannot catch this by reading the code, because the wrong spelling
 * looks exactly like the right one. The spec can.
 *
 * **The spec is gitignored** (`research/`, a paid-data directory), so this test
 * skips rather than fails when it is absent. That is deliberate: a contributor
 * without the file should not see a red suite, and the check is a guard for the
 * maintainer who spends the money, not a contract for the site.
 * ---------------------------------------------------------------------------
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SPEC = resolve(process.cwd(), "research", "x-api-2026-09-20", "openapi.json");
const SCRIPTS = resolve(process.cwd(), "scripts");

/** Values the API returns by default and which no `*.fields` parameter accepts. */
const DEFAULT_FIELDS = new Set(["id", "text", "author_id", "referenced_tweets", "username"]);

interface Spec {
  paths: Record<string, { get?: { parameters?: unknown[] } }>;
}

function loadSpec(): Spec | null {
  if (!existsSync(SPEC)) return null;
  return JSON.parse(readFileSync(SPEC, "utf-8")) as Spec;
}

/**
 * Every enum value **any** endpoint accepts for a given parameter name.
 *
 * Deliberately a union rather than a per-endpoint lookup, and the looseness is
 * worth stating: `tweet.fields` is documented on several endpoints but not on
 * `/2/tweets` or `/2/tweets/{id}/quote_tweets`, where it still works as a legacy
 * alias. A strict per-endpoint check would flag every one of this project's
 * historical calls as invalid when they demonstrably succeed.
 *
 * So this catches a value that exists nowhere in the API — the class that
 * produced both real bugs — and does not catch a value valid somewhere else but
 * wrong here. The per-file dialect assertions below cover that narrower case.
 */
function allowedValues(spec: Spec, parameter: string): Set<string> {
  const deref = (ref: unknown): Record<string, unknown> => {
    const node = ref as { $ref?: string };
    if (!node?.$ref) return ref as Record<string, unknown>;
    return node.$ref
      .split("/")
      .reduce<unknown>((object, key) => (key === "#" ? spec : (object as never)[key]), spec) as Record<
      string,
      unknown
    >;
  };

  const allowed = new Set<string>();
  for (const path of Object.values(spec.paths)) {
    for (const raw of path.get?.parameters ?? []) {
      const param = deref(raw) as { name?: string; schema?: { items?: { enum?: string[] } } };
      if (param.name !== parameter) continue;
      for (const value of param.schema?.items?.enum ?? []) allowed.add(value);
    }
  }
  return allowed;
}

interface Usage {
  file: string;
  parameter: string;
  value: string;
}

/**
 * Every field/expansion value a script sends, including the ones built from a
 * `const` the request string interpolates.
 *
 * Resolving those constants is not optional thoroughness: `enrich:twitter` keeps
 * its whole field list in `TWEET_FIELDS`, so a matcher that only reads literal
 * query strings validates nothing about the script that has been making paid
 * calls the longest.
 */
function collectUsages(): Usage[] {
  const usages: Usage[] = [];

  for (const file of readdirSync(SCRIPTS).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(resolve(SCRIPTS, file), "utf-8");

    // `const NAME = "a,b,c";` — the shape every script uses for a field list.
    const constants = new Map<string, string>();
    for (const match of source.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/g)) {
      constants.set(match[1]!, match[2]!);
    }

    const resolveValue = (raw: string): string | null => {
      const interpolated = raw.match(/^\$\{([A-Z][A-Z0-9_]*)\}$/);
      if (interpolated) return constants.get(interpolated[1]!) ?? null;
      return /^[A-Za-z0-9_,.]+$/.test(raw) ? raw : null;
    };

    const record = (parameter: string, raw: string): void => {
      const resolved = resolveValue(raw);
      if (resolved === null) return;
      for (const value of resolved.split(",").filter(Boolean)) usages.push({ file, parameter, value });
    };

    for (const match of source.matchAll(/([a-z_]+\.fields)=(\$\{[A-Z][A-Z0-9_]*\}|[A-Za-z0-9_,.]+)/g)) {
      record(match[1]!, match[2]!);
    }
    for (const match of source.matchAll(/[?&]expansions=(\$\{[A-Z][A-Z0-9_]*\}|[A-Za-z0-9_,.]+)/g)) {
      record("expansions", match[1]!);
    }
  }
  return usages;
}

const spec = loadSpec();

describe.skipIf(spec === null)("every requested API field exists in the OpenAPI spec", () => {
  it("finds request strings to check", () => {
    expect(collectUsages().length).toBeGreaterThan(0);
  });

  it("sends no field value the API would silently ignore", () => {
    const offenders = collectUsages().filter((usage) => {
      if (DEFAULT_FIELDS.has(usage.value)) return false;
      return !allowedValues(spec!, usage.parameter).has(usage.value);
    });

    expect(
      offenders.map((o) => `${o.file}: ${o.parameter}=${o.value}`),
      "these values are not in the spec's enum, so the API accepts the request, bills it, " +
        "and returns the field as absent — check the vocabulary (post.fields vs tweet.fields)",
    ).toEqual([]);
  });

  it("never mixes both field-parameter vocabularies in one script", () => {
    // `tweet.fields` still works and `enrich:twitter` uses it consistently with
    // `note_tweet`. What breaks is sending one dialect and reading the other, so
    // the rule is internal consistency per script rather than a blanket ban.
    const byFile = new Map<string, Set<string>>();
    for (const usage of collectUsages()) {
      if (!usage.parameter.endsWith(".fields") || usage.parameter === "user.fields") continue;
      const held = byFile.get(usage.file) ?? new Set<string>();
      held.add(usage.parameter);
      byFile.set(usage.file, held);
    }
    const mixed = [...byFile.entries()].filter(([, params]) => params.size > 1);
    expect(mixed.map(([file]) => file)).toEqual([]);
  });

  it("never requests a note field in the wrong dialect", () => {
    const wrong = collectUsages().filter(
      (usage) =>
        (usage.parameter === "tweet.fields" && usage.value === "note_post") ||
        (usage.parameter === "post.fields" && usage.value === "note_tweet"),
    );
    expect(wrong.map((w) => `${w.file}: ${w.parameter}=${w.value}`)).toEqual([]);
  });
});
