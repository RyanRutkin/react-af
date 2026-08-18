import type { JSONSchema } from "../types/schema";

export function createDefaultValueFromSchema(schema: JSONSchema): unknown {
  if (schema.default !== undefined) {
    return schema.default;
  }

  const type = getPrimaryType(schema);

  switch (type) {
    case "object": {
      const result: Record<string, unknown> = {};
      const required = new Set(schema.required ?? []);
      const properties = schema.properties ?? {};

      for (const [key, childSchema] of Object.entries(properties)) {
        if (required.has(key) || childSchema.default !== undefined) {
          result[key] = createDefaultValueFromSchema(childSchema);
        }
      }

      return result;
    }
    case "array":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return undefined;
    case "null":
      return null;
    case "string":
      return schema.enum?.[0] ?? "";
    default:
      return undefined;
  }
}

function getPrimaryType(schema: JSONSchema): string | undefined {
  if (Array.isArray(schema.type)) {
    return schema.type[0];
  }
  return schema.type;
}
