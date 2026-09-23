import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  JSON_SCHEMA_EXPORTS,
  buildJsonSchema,
  serializeJsonSchema,
} from "../src/lib/validation/json-schema-export";
import { checkAgainstMinimalSchema } from "../src/lib/validation/minimal-json-schema-check";
import { statusEnum } from "../src/schemas/shared";
import { postPlatformEnum } from "../src/schemas/post.schema";
import {
  amplificationCategoryEnum,
  amplificationActionEnum,
} from "../src/schemas/amplification.schema";
import { mediaReferenceTypeEnum } from "../src/schemas/media.schema";

const DATA_DIR = resolve(process.cwd(), "data");
const SCHEMAS_DIR = resolve(DATA_DIR, "schemas");

function readCommittedSchema(fileName: string): string {
  return readFileSync(resolve(SCHEMAS_DIR, fileName), "utf-8");
}

function readDataFile(fileName: string): unknown {
  return JSON.parse(readFileSync(resolve(DATA_DIR, fileName), "utf-8"));
}

function generatedSchemaFor(fileName: string): Record<string, unknown> {
  const spec = JSON_SCHEMA_EXPORTS.find((entry) => entry.fileName === fileName);
  if (!spec) throw new Error(`no JSON_SCHEMA_EXPORTS entry for "${fileName}"`);
  return buildJsonSchema(spec);
}

// --- 1. committed files must match what the Zod schemas generate right now ------
describe("data/schemas/*.schema.json — matches the Zod schemas", () => {
  it.each(JSON_SCHEMA_EXPORTS.map((spec) => spec.fileName))(
    "%s is exactly what buildJsonSchema() produces today",
    (fileName) => {
      const committed = readCommittedSchema(fileName);
      const spec = JSON_SCHEMA_EXPORTS.find((entry) => entry.fileName === fileName)!;
      const fresh = serializeJsonSchema(buildJsonSchema(spec));
      expect(
        committed,
        `data/schemas/${fileName} is stale — run "pnpm generate:schemas" and commit the result`,
      ).toBe(fresh);
    },
  );

  it("ends with a single trailing LF newline, no trailing comma, no CR", () => {
    for (const spec of JSON_SCHEMA_EXPORTS) {
      const committed = readCommittedSchema(spec.fileName);
      expect(committed.endsWith("}\n")).toBe(true);
      expect(committed.includes("\r")).toBe(false);
    }
  });
});

// --- 2. structural facts: what the Zod schemas cannot express is still meaningful ---
describe("generated schemas are structurally meaningful", () => {
  it("posts.schema.json is an array whose items require id/platform/url/status, matching the enums", () => {
    const schema = generatedSchemaFor("posts.schema.json");
    expect(schema.type).toBe("array");
    const items = schema.items as Record<string, unknown>;
    const required = items.required as string[];
    for (const field of ["id", "platform", "url", "status"]) {
      expect(required).toContain(field);
    }
    const properties = items.properties as Record<string, Record<string, unknown>>;
    expect(properties.status!.enum).toEqual(statusEnum.options);
    expect(properties.platform!.enum).toEqual(postPlatformEnum.options);
    // docs/DATA.md §5 — a post must carry at least one observation.
    expect((properties.observations as Record<string, unknown>).minItems).toBe(1);
  });

  it("amplifications.schema.json is an array whose items require id/entity_type/action/evidence_url/status, matching the enums", () => {
    const schema = generatedSchemaFor("amplifications.schema.json");
    expect(schema.type).toBe("array");
    const items = schema.items as Record<string, unknown>;
    const required = items.required as string[];
    for (const field of ["id", "entity_type", "action", "evidence_url", "status"]) {
      expect(required).toContain(field);
    }
    const properties = items.properties as Record<string, Record<string, unknown>>;
    expect(properties.status!.enum).toEqual(statusEnum.options);
    expect(properties.category!.enum).toEqual(amplificationCategoryEnum.options);
    expect(properties.action!.enum).toEqual(amplificationActionEnum.options);
  });

  it("media.schema.json is an array whose items require id/publication/url/status, matching the enums", () => {
    const schema = generatedSchemaFor("media.schema.json");
    expect(schema.type).toBe("array");
    const items = schema.items as Record<string, unknown>;
    const required = items.required as string[];
    for (const field of ["id", "publication", "url", "status"]) {
      expect(required).toContain(field);
    }
    const properties = items.properties as Record<string, Record<string, unknown>>;
    expect(properties.status!.enum).toEqual(statusEnum.options);
    expect(properties.reference_type!.enum).toEqual(mediaReferenceTypeEnum.options);
  });

  it("project.schema.json is an object requiring the non-metric project metadata fields", () => {
    const schema = generatedSchemaFor("project.schema.json");
    expect(schema.type).toBe("object");
    const required = schema.required as string[];
    for (const field of ["project_name", "official_project_url", "official_x_account"]) {
      expect(required).toContain(field);
    }
  });

  it("uses only the keyword subset checkAgainstMinimalSchema understands (no $ref/$defs/oneOf/allOf)", () => {
    for (const spec of JSON_SCHEMA_EXPORTS) {
      const serialized = JSON.stringify(buildJsonSchema(spec));
      for (const unsupportedKeyword of ["$ref", "$defs", "oneOf", "allOf", "\"const\""]) {
        expect(serialized.includes(unsupportedKeyword)).toBe(false);
      }
    }
  });
});

// --- 3. the live data files conform to their own generated JSON Schema ------------
describe("data/*.json conforms to its generated JSON Schema", () => {
  it.each([
    ["posts.json", "posts.schema.json"],
    ["amplifications.json", "amplifications.schema.json"],
    ["media.json", "media.schema.json"],
    ["project.json", "project.schema.json"],
  ])("%s validates against %s", (dataFile, schemaFile) => {
    const data = readDataFile(dataFile);
    const schema = generatedSchemaFor(schemaFile);
    const violations = checkAgainstMinimalSchema(data, schema);
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
