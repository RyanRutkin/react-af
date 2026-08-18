export type JSONSchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";

export interface JSONSchema {
  $id?: string;
  $schema?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: JSONSchemaType | JSONSchemaType[];
  enum?: unknown[];
  default?: unknown;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema | JSONSchema[];
  additionalProperties?: boolean | JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  [key: string]: unknown;
}

export type OutputData = unknown;
export type PeerSchemasInput = JSONSchema[] | Record<string, JSONSchema>;
