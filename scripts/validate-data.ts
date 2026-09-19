/**
 * pnpm validate:data
 *
 * Validates every canonical data file in `data/` against its Zod schema and the
 * cross-file rules in docs/DATA.md §12 that a single-file schema cannot express
 * (dangling `related_post_id` references). Reports the exact file, record id and
 * field for every problem found, and exits non-zero if any hard error exists.
 *
 * Placeholder records are reported but do not fail this script — that is
 * `check:production-data`'s job (docs/DATA.md §3, §12).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ZodIssue } from "zod";

import { postsFileSchema } from "../src/schemas/post.schema";
import { amplificationsFileSchema } from "../src/schemas/amplification.schema";
import { mediaFileSchema } from "../src/schemas/media.schema";
import { projectSchema } from "../src/schemas/project.schema";
import { findDanglingRelatedPostIds } from "../src/lib/validation/related-post-reference";

type ReferencingRecord = { id?: string; related_post_id?: string | null };

const DATA_DIR = resolve(process.cwd(), "data");

let hasErrors = false;
const placeholderNotes: string[] = [];

function readJson(fileName: string): unknown {
  const filePath = resolve(DATA_DIR, fileName);
  const raw = readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    hasErrors = true;
    console.error(`[${fileName}] invalid JSON: ${(error as Error).message}`);
    return null;
  }
}

/** Reports every Zod issue for an array file, resolving `path[0]` back to a record id. */
function reportArrayIssues(fileName: string, rawRecords: unknown[], issues: ZodIssue[]) {
  for (const issue of issues) {
    const [index, ...rest] = issue.path;
    const record =
      typeof index === "number" ? (rawRecords[index] as { id?: unknown } | undefined) : undefined;
    const recordId = record?.id ?? "(unknown id)";
    const field = rest.length > 0 ? rest.join(".") : "(record)";
    console.error(`[${fileName}] record ${recordId} — field "${field}": ${issue.message}`);
  }
  hasErrors = true;
}

function reportObjectIssues(fileName: string, issues: ZodIssue[]) {
  for (const issue of issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    console.error(`[${fileName}] field "${field}": ${issue.message}`);
  }
  hasErrors = true;
}

function collectPlaceholders(fileName: string, rawRecords: unknown[]) {
  for (const record of rawRecords) {
    const candidate = record as { id?: unknown; _placeholder?: unknown };
    if (candidate._placeholder === true) {
      placeholderNotes.push(`[${fileName}] ${candidate.id ?? "(unknown id)"}`);
    }
  }
}

// --- posts.json -------------------------------------------------------------
const rawPosts = readJson("posts.json");
const postIds = new Set<string>();
if (Array.isArray(rawPosts)) {
  const result = postsFileSchema.safeParse(rawPosts);
  if (!result.success) reportArrayIssues("posts.json", rawPosts, result.error.issues);
  collectPlaceholders("posts.json", rawPosts);
  for (const post of rawPosts) {
    const id = (post as { id?: unknown }).id;
    if (typeof id === "string") postIds.add(id);
  }
} else if (rawPosts !== null) {
  hasErrors = true;
  console.error("[posts.json] expected a JSON array");
}

// --- amplifications.json -----------------------------------------------------
const rawAmplifications = readJson("amplifications.json");
if (Array.isArray(rawAmplifications)) {
  const result = amplificationsFileSchema.safeParse(rawAmplifications);
  if (!result.success) reportArrayIssues("amplifications.json", rawAmplifications, result.error.issues);
  collectPlaceholders("amplifications.json", rawAmplifications);
  checkDanglingReferences("amplifications.json", rawAmplifications as ReferencingRecord[], postIds);
} else if (rawAmplifications !== null) {
  hasErrors = true;
  console.error("[amplifications.json] expected a JSON array");
}

// --- media.json ----------------------------------------------------------------
const rawMedia = readJson("media.json");
if (Array.isArray(rawMedia)) {
  const result = mediaFileSchema.safeParse(rawMedia);
  if (!result.success) reportArrayIssues("media.json", rawMedia, result.error.issues);
  collectPlaceholders("media.json", rawMedia);
  checkDanglingReferences("media.json", rawMedia as ReferencingRecord[], postIds);
} else if (rawMedia !== null) {
  hasErrors = true;
  console.error("[media.json] expected a JSON array");
}

// --- project.json ------------------------------------------------------------
const rawProject = readJson("project.json");
if (rawProject !== null) {
  const result = projectSchema.safeParse(rawProject);
  if (!result.success) reportObjectIssues("project.json", result.error.issues);
}

/** Wraps the shared pure checker with this script's file-scoped error reporting. */
function checkDanglingReferences(
  fileName: string,
  records: Array<{ id?: string; related_post_id?: string | null }>,
  validPostIds: Set<string>,
) {
  const normalized = records.map((record) => ({
    id: record.id,
    related_post_id: record.related_post_id ?? null,
  }));
  const dangling = findDanglingRelatedPostIds(normalized, validPostIds);
  for (const { id, related_post_id } of dangling) {
    hasErrors = true;
    console.error(
      `[${fileName}] record ${id ?? "(unknown id)"} — field "related_post_id": ` +
        `references unknown post id "${related_post_id}"`,
    );
  }
}

// --- report --------------------------------------------------------------------
if (placeholderNotes.length > 0) {
  console.log(`\n${placeholderNotes.length} placeholder record(s) found (development only):`);
  for (const note of placeholderNotes) console.log(`  ${note}`);
}

if (hasErrors) {
  console.error("\nvalidate:data FAILED");
  process.exit(1);
} else {
  console.log("\nvalidate:data passed — all canonical data files are valid.");
}
