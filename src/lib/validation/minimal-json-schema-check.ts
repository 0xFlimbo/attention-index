/**
 * A minimal, dependency-free checker for the handful of JSON Schema keywords the
 * generated files in `data/schemas/` actually use: `type`, `enum`, `pattern`,
 * `format: "uri"`, `minLength`, `minItems`, `minimum`, `maximum`, `properties`,
 * `required`, `items`, `anyOf`. It exists so
 * `tests/json-schema-export.test.ts` can validate the live `data/*.json` files
 * against the JSON Schema `pnpm generate:schemas` produces, without adding a
 * JSON Schema validator dependency (docs/ENGINEERING.md §1's dependency gate).
 *
 * It is not a general-purpose validator: no `$ref`/`$defs`, `oneOf`, `allOf`,
 * `const`, `if`/`then`, or numeric `multipleOf`. None of the four generated
 * schemas uses those keywords today (verified in
 * `tests/json-schema-export.test.ts`), so this covers exactly what they emit —
 * nothing more.
 */

type JsonSchemaLike = Record<string, unknown>;

/** Returns one message per violation; an empty array means `value` conforms. */
export function checkAgainstMinimalSchema(
  value: unknown,
  schema: JsonSchemaLike,
  path = "$",
): string[] {
  if ("anyOf" in schema) {
    const branches = schema.anyOf as JsonSchemaLike[];
    const matchesABranch = branches.some(
      (branch) => checkAgainstMinimalSchema(value, branch, path).length === 0,
    );
    return matchesABranch ? [] : [`${path}: matches none of the anyOf branches`];
  }

  const violations: string[] = [];

  if ("type" in schema) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((type) => matchesJsonSchemaType(value, type))) {
      // A type mismatch makes every other keyword meaningless to check.
      return [`${path}: expected type ${types.join(" | ")}, got ${jsonTypeOf(value)}`];
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    violations.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (typeof value === "string") {
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
      violations.push(`${path}: "${value}" does not match pattern ${schema.pattern}`);
    }
    if (schema.format === "uri" && !isAbsoluteUri(value)) {
      violations.push(`${path}: "${value}" is not an absolute URI`);
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      violations.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      violations.push(`${path}: ${value} is below minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      violations.push(`${path}: ${value} is above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      violations.push(`${path}: has ${value.length} items, fewer than minItems ${schema.minItems}`);
    }
    if (schema.items && typeof schema.items === "object") {
      value.forEach((item, index) => {
        violations.push(
          ...checkAgainstMinimalSchema(item, schema.items as JsonSchemaLike, `${path}[${index}]`),
        );
      });
    }
    return violations;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in record)) violations.push(`${path}: missing required property "${key}"`);
    }
    const properties = (schema.properties as Record<string, JsonSchemaLike> | undefined) ?? {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in record) {
        violations.push(...checkAgainstMinimalSchema(record[key], propertySchema, `${path}.${key}`));
      }
    }
  }

  return violations;
}

function matchesJsonSchemaType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number";
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function jsonTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/** `format: "uri"` (draft 2020-12) means an absolute URI — the same contract `absoluteUrlString` enforces. */
function isAbsoluteUri(value: string): boolean {
  try {
    void new URL(value);
    return true;
  } catch {
    return false;
  }
}
