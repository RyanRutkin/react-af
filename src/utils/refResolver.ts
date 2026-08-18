import { getByPointer } from "json-pointer-relational";
import type { JSONSchema, PeerSchemasInput } from "../types/schema";

interface SchemaCandidate {
  identifier: string;
  schema: JSONSchema;
}

export function resolveSchemaRefs(schema: JSONSchema, peerSchemas?: PeerSchemasInput): JSONSchema {
  const cloned = deepClone(schema);
  const candidates = toSchemaCandidates(peerSchemas);
  const visiting = new Set<string>();

  return resolveNode(cloned, cloned, candidates, visiting) as JSONSchema;
}

function resolveNode(
  node: unknown,
  currentSchemaRoot: JSONSchema,
  candidates: SchemaCandidate[],
  visiting: Set<string>
): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => resolveNode(entry, currentSchemaRoot, candidates, visiting));
  }

  if (!isObject(node)) {
    return node;
  }

  if (typeof node.$ref === "string") {
    const resolved = resolveRefNode(node, currentSchemaRoot, candidates, visiting);
    return resolveNode(resolved.value, resolved.currentSchemaRoot, candidates, visiting);
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    result[key] = resolveNode(value, currentSchemaRoot, candidates, visiting);
  }

  return result;
}

function resolveRefNode(
  node: Record<string, unknown>,
  currentSchemaRoot: JSONSchema,
  candidates: SchemaCandidate[],
  visiting: Set<string>
): { value: Record<string, unknown>; currentSchemaRoot: JSONSchema } {
  const ref = node.$ref as string;
  const recursionKey = `${currentSchemaRoot.$id ?? "local"}::${ref}`;

  if (visiting.has(recursionKey)) {
    throw new Error(`Infinite recursion detected while resolving reference: ${ref}`);
  }

  visiting.add(recursionKey);

  let targetSchema = currentSchemaRoot;
  let resultJsonPointer = ref;

  if (isExternalReference(ref)) {
    const matched = findBestCandidate(ref, candidates);
    if (!matched) {
      throw new Error(`Could not find referenced peer schema for: ${ref}`);
    }

    targetSchema = matched.schema;
    resultJsonPointer = ref.slice(matched.identifier.length);

    if (!resultJsonPointer) {
      resultJsonPointer = "#";
    }
  }

  const resolvedValue = getByPointer(resultJsonPointer, targetSchema);

  if (!isObject(resolvedValue)) {
    throw new Error(`Could not resolve JSON pointer: ${resultJsonPointer}`);
  }

  const { $ref: _omitRef, ...rest } = node;
  const merged = {
    ...deepClone(resolvedValue),
    ...rest
  };

  visiting.delete(recursionKey);
  return { value: merged, currentSchemaRoot: targetSchema };
}

function isExternalReference(ref: string): boolean {
  return !(ref.startsWith("#") || ref.startsWith("/"));
}

function findBestCandidate(ref: string, candidates: SchemaCandidate[]): SchemaCandidate | undefined {
  const matches = candidates.filter((candidate) => ref.startsWith(candidate.identifier));
  matches.sort((a, b) => b.identifier.length - a.identifier.length);
  return matches[0];
}

function toSchemaCandidates(peerSchemas?: PeerSchemasInput): SchemaCandidate[] {
  if (!peerSchemas) {
    return [];
  }

  if (Array.isArray(peerSchemas)) {
    return peerSchemas
      .filter((schema) => typeof schema.$id === "string" && schema.$id.length > 0)
      .map((schema) => ({ identifier: schema.$id as string, schema }));
  }

  return Object.entries(peerSchemas).map(([identifier, schema]) => ({ identifier, schema }));
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
