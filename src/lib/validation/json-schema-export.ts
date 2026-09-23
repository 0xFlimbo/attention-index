import { z } from "zod";

import { postsFileSchema } from "@/schemas/post.schema";
import { amplificationsFileSchema } from "@/schemas/amplification.schema";
import { mediaFileSchema } from "@/schemas/media.schema";
import { projectSchema } from "@/schemas/project.schema";

/**
 * `pnpm generate:schemas` (docs/DATA.md — "JSON Schema"). The Zod schemas in
 * `src/schemas/` stay the single source of truth; this module is the pure part of
 * turning one of them into a JSON Schema document, kept dependency-free and
 * disk-free so `tests/json-schema-export.test.ts` can call it directly and so the
 * generated files can never silently diverge from what the Zod schemas describe
 * today.
 *
 * Not every Zod rule survives the trip — see the "cannot express" list in
 * docs/DATA.md, which this module does not duplicate.
 */

const REPO_SCHEMA_BASE_URL = "https://github.com/0xFlimbo/attention-index/blob/main/data/schemas";

export interface JsonSchemaExportSpec {
  /** File name written under `data/schemas/`. */
  fileName: string;
  /** JSON Schema `title`. */
  title: string;
  /** JSON Schema `description`. */
  description: string;
  /** The Zod schema this file's JSON Schema is generated from. */
  zodSchema: z.ZodType;
}

export const JSON_SCHEMA_EXPORTS: readonly JsonSchemaExportSpec[] = [
  {
    fileName: "posts.schema.json",
    title: "LayoffHedge Attention Index — posts",
    description:
      "Tracked LayoffHedge / @LayoffAI posts and their observed public metrics " +
      "(docs/DATA.md §5). Generated from src/schemas/post.schema.ts — that Zod " +
      "schema is authoritative; see docs/DATA.md for the rules this JSON Schema " +
      "cannot express.",
    zodSchema: postsFileSchema,
  },
  {
    fileName: "amplifications.schema.json",
    title: "LayoffHedge Attention Index — amplifications",
    description:
      "Public people and organizations that amplified the tracked content " +
      "(docs/DATA.md §6). Generated from src/schemas/amplification.schema.ts — " +
      "that Zod schema is authoritative; see docs/DATA.md for the rules this " +
      "JSON Schema cannot express.",
    zodSchema: amplificationsFileSchema,
  },
  {
    fileName: "media.schema.json",
    title: "LayoffHedge Attention Index — media",
    description:
      "External media coverage and public references to the tracked content " +
      "(docs/DATA.md §7). Generated from src/schemas/media.schema.ts — that Zod " +
      "schema is authoritative; see docs/DATA.md for the rules this JSON Schema " +
      "cannot express.",
    zodSchema: mediaFileSchema,
  },
  {
    fileName: "project.schema.json",
    title: "LayoffHedge Attention Index — project metadata",
    description:
      "Project metadata: labels, links and the methodology version. Never a " +
      "metric (docs/DATA.md §9). Generated from src/schemas/project.schema.ts — " +
      "that Zod schema is authoritative.",
    zodSchema: projectSchema,
  },
] as const;

/**
 * Builds the JSON Schema document for one export spec. `io: "input"` converts the
 * shape the data files actually hold — the input a `.parse()` call accepts —
 * rather than the post-transform output type: `amplificationSchema`'s
 * `follower_count` / `follower_count_observed_at` fields use `.nullish().transform`
 * to normalize `undefined` to `null` (docs/DATA.md §6), and `io: "output"` throws
 * ("Transforms cannot be represented in JSON Schema") on exactly that field.
 * `io: "input"` is also the more honest contract for this use: the JSON Schema
 * files exist so someone can validate the raw JSON in `data/` before any Zod code
 * runs, and that raw JSON is the input side, not the parsed/transformed side.
 *
 * `unrepresentable` is left at its default (`"throw"`, not `"any"`): every schema
 * here converts cleanly under `io: "input"` (verified by
 * `tests/json-schema-export.test.ts`), and a future schema change that stops
 * converting cleanly should fail `pnpm generate:schemas` loudly rather than
 * silently emit a weaker `{}` in its place — consistent with how
 * `scripts/validate-data.ts` and `scripts/check-production-data.ts` fail loudly
 * elsewhere in this project rather than degrade quietly.
 */
export function buildJsonSchema(spec: JsonSchemaExportSpec): Record<string, unknown> {
  const generated = z.toJSONSchema(spec.zodSchema, {
    target: "draft-2020-12",
    io: "input",
  }) as Record<string, unknown>;

  const { $schema, ...rest } = generated;

  // Stable key order: $schema, $id, title, description, then whatever z.toJSONSchema
  // produced (type/items/properties/required/…), whose own order is deterministic —
  // it follows the Zod schema's field declaration order.
  return {
    $schema,
    $id: `${REPO_SCHEMA_BASE_URL}/${spec.fileName}`,
    title: spec.title,
    description: spec.description,
    ...rest,
  };
}

/** 2-space indent, trailing newline, LF — docs/DATA.md §2's formatting rules, applied to schemas too. */
export function serializeJsonSchema(schema: Record<string, unknown>): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
