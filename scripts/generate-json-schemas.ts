/**
 * pnpm generate:schemas
 *
 * Writes `data/schemas/*.schema.json` from the Zod schemas in `src/schemas/`
 * (docs/DATA.md — "JSON Schema"). The Zod schemas stay authoritative; these
 * files exist so someone can validate `data/*.json` without TypeScript, using
 * any JSON Schema draft 2020-12 validator.
 *
 * Deterministic: same input, same bytes, every run — `tests/json-schema-export.test.ts`
 * fails if a committed file in `data/schemas/` differs from what this script would
 * write today, so a schema change that isn't followed by a re-run is caught in CI
 * rather than shipping a stale contract.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  JSON_SCHEMA_EXPORTS,
  buildJsonSchema,
  serializeJsonSchema,
} from "../src/lib/validation/json-schema-export";

const OUTPUT_DIR = resolve(process.cwd(), "data", "schemas");

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const spec of JSON_SCHEMA_EXPORTS) {
  const outputPath = resolve(OUTPUT_DIR, spec.fileName);
  const contents = serializeJsonSchema(buildJsonSchema(spec));
  writeFileSync(outputPath, contents, "utf-8");
  console.log(`wrote data/schemas/${spec.fileName}`);
}

console.log(`\n${JSON_SCHEMA_EXPORTS.length} JSON Schema file(s) generated.`);
