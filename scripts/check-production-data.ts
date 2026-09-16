/**
 * pnpm check:production-data
 *
 * Production gate (docs/DATA.md §12, docs/CLAUDE.md §3): a build must never ship
 * visible placeholder data, headline metrics must never be computed from anything
 * other than verified, non-placeholder records, and required project metadata must
 * be present. Exits non-zero on any violation, reporting the exact file and record id.
 *
 * This is expected to FAIL once development fixtures are added to `data/` — say so
 * explicitly rather than hiding it (docs/ENGINEERING.md §8). It currently PASSES
 * because `data/` has no `_placeholder` records (docs/DATA.md "Current state").
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getPosts } from "../src/lib/data/posts";
import { getAmplifications } from "../src/lib/data/amplifications";
import { getMediaReferences } from "../src/lib/data/media";
import { getProjectMetadata } from "../src/lib/data/project";
import { getAttentionMetrics } from "../src/lib/metrics/attention";
import { getAmplificationMetrics } from "../src/lib/metrics/amplification";
import { getMediaMetrics } from "../src/lib/metrics/media";
import { findVisiblePlaceholders } from "../src/lib/validation/placeholder";

const DATA_DIR = resolve(process.cwd(), "data");
let hasErrors = false;

type MinimalRecord = { id?: string; status?: unknown; _placeholder?: boolean };

function readRaw(fileName: string): MinimalRecord[] {
  return JSON.parse(readFileSync(resolve(DATA_DIR, fileName), "utf-8")) as MinimalRecord[];
}

/** docs/DATA.md §17 — placeholder records must never ship visibly to production. */
function checkNoVisiblePlaceholders(fileName: string): void {
  for (const record of findVisiblePlaceholders(readRaw(fileName))) {
    hasErrors = true;
    console.error(`[${fileName}] record ${record.id ?? "(unknown id)"} is a visible _placeholder record`);
  }
}

/** Independently re-derives the eligible count so an eligibility-filter bug fails loudly. */
function countEligible(fileName: string): number {
  return readRaw(fileName).filter(
    (record) => record.status === "verified" && record._placeholder !== true,
  ).length;
}

for (const file of ["posts.json", "amplifications.json", "media.json", "milestones.json"]) {
  checkNoVisiblePlaceholders(file);
}

try {
  const attention = getAttentionMetrics(getPosts());
  const expectedPosts = countEligible("posts.json");
  if (attention.trackedPostCount !== expectedPosts) {
    hasErrors = true;
    console.error(
      `[posts.json] attention metrics used ${attention.trackedPostCount} eligible posts, ` +
        `expected ${expectedPosts} (verified && !_placeholder)`,
    );
  }

  const amplification = getAmplificationMetrics(getAmplifications());
  const expectedAmps = countEligible("amplifications.json");
  if (amplification.verifiedAmplificationCount !== expectedAmps) {
    hasErrors = true;
    console.error(
      `[amplifications.json] amplification metrics used ${amplification.verifiedAmplificationCount} ` +
        `eligible records, expected ${expectedAmps} (verified && !_placeholder)`,
    );
  }

  const media = getMediaMetrics(getMediaReferences());
  const expectedMedia = countEligible("media.json");
  if (media.verifiedMediaReferenceCount !== expectedMedia) {
    hasErrors = true;
    console.error(
      `[media.json] media metrics used ${media.verifiedMediaReferenceCount} eligible records, ` +
        `expected ${expectedMedia} (verified && !_placeholder)`,
    );
  }
} catch (error) {
  hasErrors = true;
  console.error(`data failed to load/validate: ${(error as Error).message}`);
}

try {
  const project = getProjectMetadata();
  const requiredNonEmpty: Array<[string, string]> = [
    ["project_name", project.project_name],
    ["short_name", project.short_name],
    ["disclaimer", project.disclaimer],
    ["data_last_updated", project.data_last_updated],
    ["methodology_version", project.methodology_version],
  ];
  for (const [field, value] of requiredNonEmpty) {
    if (value.trim().length === 0) {
      hasErrors = true;
      console.error(`[project.json] required field "${field}" is missing or empty`);
    }
  }
} catch (error) {
  hasErrors = true;
  console.error(`[project.json] failed to load: ${(error as Error).message}`);
}

if (hasErrors) {
  console.error("\ncheck:production-data FAILED");
  process.exit(1);
} else {
  console.log(
    "check:production-data passed — no visible placeholder data, metrics derived from verified records only, project metadata present.",
  );
}
