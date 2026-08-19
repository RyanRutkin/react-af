import { useEffect, useMemo, useRef, useState } from "react";
import type { SchemaBuilderProps, SchemaBuilderValidationError } from "../types/components";
import type { JSONSchema, JSONSchemaType } from "../types/schema";
import { createAjvForSchema } from "../utils/schemaValidation";

type SchemaCombinationKey = "allOf" | "anyOf" | "oneOf";

const FIELD_TYPES: JSONSchemaType[] = ["string", "number", "integer", "boolean", "object", "array", "null"];

const DEFAULT_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema";

export function SchemaBuilder({ schema, domain, onChange, onValidationError }: SchemaBuilderProps) {
  const [currentSchema, setCurrentSchema] = useState<JSONSchema>(() => schema ?? createDefaultRootSchema());
  const [rawJson, setRawJson] = useState(() => JSON.stringify(schema ?? createDefaultRootSchema(), null, 2));
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  const onValidationErrorRef = useRef(onValidationError);
  const publishedSchema = useMemo(() => {
    const sanitized = sanitizeSchemaForOutput(currentSchema);
    return applyDomainToRootId(sanitized, domain);
  }, [currentSchema, domain]);

  useEffect(() => {
    onChangeRef.current = onChange;
    onValidationErrorRef.current = onValidationError;
  }, [onChange, onValidationError]);

  useEffect(() => {
    if (schema) {
      setCurrentSchema(cloneSchema(schema));
    }
  }, [schema]);

  useEffect(() => {
    setRawJson(JSON.stringify(currentSchema, null, 2));
    const validationErrors = validateSchemaDefinition(publishedSchema);
    if (validationErrors.length > 0) {
      onValidationErrorRef.current?.(validationErrors);
    }
    onChangeRef.current?.(publishedSchema);
  }, [currentSchema, publishedSchema]);

  const handleRootChange = (nextSchema: JSONSchema) => {
    setCurrentSchema(nextSchema);
  };

  const prettySchema = useMemo(() => JSON.stringify(publishedSchema, null, 2), [publishedSchema]);

  return (
    <div className="raf-schema-builder">
      <SchemaNodeEditor
        schema={currentSchema}
        label="Root Schema"
        isRoot={true}
        domain={domain}
        onChange={handleRootChange}
      />

      <details className="raf-object">
        <summary className="raf-object-summary">Advanced: Edit Full Schema JSON</summary>
        <div className="raf-object-content">
          <textarea
            className="raf-textarea"
            value={rawJson}
            onChange={(event) => {
              const nextText = event.target.value;
              setRawJson(nextText);

              try {
                const parsed = JSON.parse(nextText) as JSONSchema;
                if (!isObject(parsed)) {
                  const message = "Schema JSON must be an object.";
                  setRawJsonError(message);
                  onValidationErrorRef.current?.([
                    {
                      message,
                      source: "json-parse"
                    }
                  ]);
                  return;
                }

                setRawJsonError(null);
                setCurrentSchema(parsed);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Invalid JSON.";
                setRawJsonError(message);
                onValidationErrorRef.current?.([
                  {
                    message,
                    source: "json-parse"
                  }
                ]);
              }
            }}
          />
          {rawJsonError ? <div className="raf-error">{rawJsonError}</div> : null}
        </div>
      </details>

      <details className="raf-object">
        <summary className="raf-object-summary">Preview JSON Schema</summary>
        <div className="raf-object-content">
          <pre className="raf-json-preview">{prettySchema}</pre>
        </div>
      </details>
    </div>
  );
}

interface SchemaNodeEditorProps {
  schema: JSONSchema;
  label: string;
  onChange: (next: JSONSchema) => void;
  onRemove?: () => void;
  isRoot?: boolean;
  domain?: string;
}

function SchemaNodeEditor({ schema, label, onChange, onRemove, isRoot = false, domain }: SchemaNodeEditorProps) {
  const schemaTypes = getSchemaTypes(schema);
  const hasType = (type: JSONSchemaType) => schemaTypes.includes(type);
  const editableRootId = isRoot ? toLocalId(stringOrEmpty(schema.$id), domain) : stringOrEmpty(schema.$id);
  const fullRootId = isRoot ? toFullId(editableRootId, domain) : editableRootId;

  return (
    <details className="raf-object" open>
      <summary className="raf-object-summary">{label}</summary>
      <div className="raf-object-content">
        <div className="raf-builder-grid">
          {isRoot ? (
            <>
              <TextInput
                label="$id"
                value={editableRootId}
                onChange={(value) => onChange(assignOptionalString(schema, "$id", toLocalId(value, domain)))}
                helperText={domain ? `Full $id: ${fullRootId || "(empty)"}` : undefined}
              />
              <TextInput
                label="$schema"
                value={stringOrEmpty(schema.$schema)}
                onChange={(value) => onChange(assignOptionalString(schema, "$schema", value))}
                placeholder={DEFAULT_SCHEMA_URI}
              />
            </>
          ) : null}
          <TextInput
            label="$ref"
            value={stringOrEmpty(schema.$ref)}
            onChange={(value) => onChange(assignOptionalString(schema, "$ref", value))}
          />
          <TextInput
            label="Title"
            value={stringOrEmpty(schema.title)}
            onChange={(value) => onChange(assignOptionalString(schema, "title", value))}
          />
        </div>

        <TextAreaInput
          label="Description"
          value={stringOrEmpty(schema.description)}
          onChange={(value) => onChange(assignOptionalString(schema, "description", value))}
        />

        <div className="raf-builder-grid">
          <TypeListEditor
            value={schemaTypes}
            onChange={(nextTypes) => onChange(applyTypes(schema, nextTypes))}
          />
          <TextInput
            label="Default (JSON)"
            value={schema.default === undefined ? "" : toInlineJson(schema.default)}
            onChange={(value) => {
              if (value.trim() === "") {
                const next = cloneSchema(schema);
                delete next.default;
                onChange(next);
                return;
              }

              try {
                const parsed = JSON.parse(value);
                onChange({ ...schema, default: parsed });
              } catch {
                // Ignore invalid JSON while user is typing.
              }
            }}
            placeholder='e.g. "abc", 42, true, {"k":"v"}'
          />
        </div>

        {(hasType("string") || hasType("number") || hasType("integer")) ? (
          <TextInput
            label="Enum (JSON array)"
            value={Array.isArray(schema.enum) ? JSON.stringify(schema.enum) : ""}
            onChange={(value) => {
              if (value.trim() === "") {
                const next = cloneSchema(schema);
                delete next.enum;
                onChange(next);
                return;
              }

              try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                  onChange({ ...schema, enum: parsed });
                }
              } catch {
                // Ignore invalid JSON while user is typing.
              }
            }}
            placeholder='e.g. ["A", "B"]'
          />
        ) : null}

        {hasType("string") ? (
          <TextInput
            label="Pattern"
            value={stringOrEmpty(schema.pattern)}
            onChange={(value) => onChange(assignOptionalString(schema, "pattern", value))}
            placeholder="e.g. ^[A-Za-z]+$"
          />
        ) : null}

        {hasType("number") || hasType("integer") ? (
          <div className="raf-builder-grid">
            <TextInput
              label="Min"
              value={numberOrEmpty(schema.minimum)}
              onChange={(value) => onChange(assignOptionalNumber(schema, "minimum", value))}
              type="number"
              step="any"
              placeholder="e.g. 0"
            />
            <TextInput
              label="Max"
              value={numberOrEmpty(schema.maximum)}
              onChange={(value) => onChange(assignOptionalNumber(schema, "maximum", value))}
              type="number"
              step="any"
              placeholder="e.g. 100"
            />
          </div>
        ) : null}

        {hasType("object") ? (
          <ObjectSchemaEditor schema={schema} onChange={onChange} />
        ) : null}

        {hasType("array") ? (
          <ArraySchemaEditor schema={schema} onChange={onChange} />
        ) : null}

        <CombinationEditor kind="allOf" schema={schema} onChange={onChange} />
        <CombinationEditor kind="anyOf" schema={schema} onChange={onChange} />
        <CombinationEditor kind="oneOf" schema={schema} onChange={onChange} />

        {!isRoot && onRemove ? (
          <div className="raf-button-row">
            <button className="raf-button raf-button-danger" type="button" onClick={onRemove}>
              Remove Field
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ObjectSchemaEditor({ schema, onChange }: { schema: JSONSchema; onChange: (next: JSONSchema) => void }) {
  const properties = schema.properties ?? {};
  const requiredSet = new Set(schema.required ?? []);
  const additionalPropertiesEnabled = schema.additionalProperties !== false;

  return (
    <div className="raf-builder-block">
      <h4 className="raf-builder-heading">Object Properties</h4>

      <label className="raf-checkbox-row">
        <input
          className="raf-checkbox"
          type="checkbox"
          checked={additionalPropertiesEnabled}
          onChange={(event) => {
            const next = cloneSchema(schema);

            if (event.target.checked) {
              if (isObject(next.additionalProperties)) {
                next.additionalProperties = next.additionalProperties as JSONSchema;
              } else {
                next.additionalProperties = true;
              }
            } else {
              next.additionalProperties = false;
            }

            onChange(next);
          }}
        />
        <span>additionalProperties</span>
      </label>

      <div className="raf-button-row">
        <button
          className="raf-button raf-button-primary"
          type="button"
          onClick={() => {
            const next = cloneSchema(schema);
            next.properties = { ...(next.properties ?? {}) };
            const newKey = createUniquePropertyName(next.properties, "field");
            next.properties[newKey] = { type: "string", title: newKey };
            onChange(next);
          }}
        >
          Add Property
        </button>
      </div>

      {Object.entries(properties).map(([propertyName, propertySchema], index) => (
        <div className="raf-builder-property" key={index}>
          <div className="raf-builder-grid">
            <TextInput
              label="Property Name"
              value={propertyName}
              onChange={(nextName) => {
                const normalized = nextName.trim();
                if (normalized === propertyName) {
                  return;
                }

                if (normalized === "") {
                  const next = cloneSchema(schema);
                  const objectProperties = { ...(next.properties ?? {}) };
                  objectProperties[""] = objectProperties[propertyName];
                  if (propertyName !== "") {
                    delete objectProperties[propertyName];
                  }
                  next.properties = objectProperties;
                  next.required = (next.required ?? []).filter((entry) => entry !== propertyName);
                  onChange(next);
                  return;
                }

                const next = cloneSchema(schema);
                const objectProperties = { ...(next.properties ?? {}) };

                if (objectProperties[normalized]) {
                  return;
                }

                objectProperties[normalized] = objectProperties[propertyName];
                delete objectProperties[propertyName];
                next.properties = objectProperties;

                const required = new Set(next.required ?? []);
                if (required.delete(propertyName)) {
                  required.add(normalized);
                  next.required = Array.from(required);
                }

                onChange(next);
              }}
            />

            <label className="raf-checkbox-row">
              <input
                className="raf-checkbox"
                type="checkbox"
                checked={requiredSet.has(propertyName)}
                onChange={(event) => {
                  const next = cloneSchema(schema);
                  const required = new Set(next.required ?? []);

                  if (event.target.checked) {
                    required.add(propertyName);
                  } else {
                    required.delete(propertyName);
                  }

                  next.required = Array.from(required);
                  onChange(next);
                }}
              />
              <span>Required</span>
            </label>
          </div>

          <SchemaNodeEditor
            label={`Property: ${propertyName}`}
            schema={propertySchema}
            onChange={(nextPropertySchema) => {
              const next = cloneSchema(schema);
              next.properties = { ...(next.properties ?? {}), [propertyName]: nextPropertySchema };
              onChange(next);
            }}
            onRemove={() => {
              const next = cloneSchema(schema);
              const objectProperties = { ...(next.properties ?? {}) };
              delete objectProperties[propertyName];
              next.properties = objectProperties;
              next.required = (next.required ?? []).filter((entry) => entry !== propertyName);
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ArraySchemaEditor({ schema, onChange }: { schema: JSONSchema; onChange: (next: JSONSchema) => void }) {
  const items = schema.items;
  const hasContains = isObject(schema.contains);

  return (
    <div className="raf-builder-block">
      {Array.isArray(items) ? (
        <>
          <h4 className="raf-builder-heading">Array Items (Tuple)</h4>
          <div className="raf-button-row">
            <button
              className="raf-button raf-button-primary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.items) ? [...next.items] : [];
                nextItems.push({ type: "string" });
                next.items = nextItems;
                onChange(next);
              }}
            >
              Add Tuple Item Schema
            </button>
          </div>

          {items.map((itemSchema, index) => (
            <SchemaNodeEditor
              key={`tuple-item-${index}`}
              label={`Tuple Item ${index + 1}`}
              schema={itemSchema}
              onChange={(nextItemSchema) => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.items) ? [...next.items] : [];
                nextItems[index] = nextItemSchema;
                next.items = nextItems;
                onChange(next);
              }}
              onRemove={() => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.items) ? [...next.items] : [];
                nextItems.splice(index, 1);
                next.items = nextItems;
                onChange(next);
              }}
            />
          ))}

          <div className="raf-button-row">
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                next.items = { type: "string" };
                onChange(next);
              }}
            >
              Switch To Single Items Schema
            </button>
          </div>
        </>
      ) : (
        <>
          <h4 className="raf-builder-heading">Array Items</h4>

          <SchemaNodeEditor
            label="Items Schema"
            schema={isObject(items) ? (items as JSONSchema) : { type: "string" }}
            onChange={(nextItemsSchema) => {
              const next = cloneSchema(schema);
              next.items = nextItemsSchema;
              onChange(next);
            }}
          />

          <div className="raf-button-row">
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                next.items = [{ type: "string" }];
                onChange(next);
              }}
            >
              Switch To Tuple Items
            </button>
          </div>
        </>
      )}

      <h4 className="raf-builder-heading">Array Constraints</h4>
      <div className="raf-builder-grid">
        <TextInput
          label="minItems"
          value={numberOrEmpty(schema.minItems)}
          onChange={(value) => onChange(assignOptionalInteger(schema, "minItems", value))}
          type="number"
          step="1"
          placeholder="e.g. 0"
        />
        <TextInput
          label="maxItems"
          value={numberOrEmpty(schema.maxItems)}
          onChange={(value) => onChange(assignOptionalInteger(schema, "maxItems", value))}
          type="number"
          step="1"
          placeholder="e.g. 10"
        />
      </div>

      <label className="raf-checkbox-row">
        <input
          className="raf-checkbox"
          type="checkbox"
          checked={Boolean(schema.uniqueItems)}
          onChange={(event) => {
            const next = cloneSchema(schema);
            if (event.target.checked) {
              next.uniqueItems = true;
            } else {
              delete next.uniqueItems;
            }
            onChange(next);
          }}
        />
        <span>uniqueItems</span>
      </label>

      <div className="raf-button-row">
        {!hasContains ? (
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              next.contains = { type: "string" };
              onChange(next);
            }}
          >
            Add contains
          </button>
        ) : (
          <button
            className="raf-button raf-button-danger"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              delete next.contains;
              delete next.minContains;
              delete next.maxContains;
              onChange(next);
            }}
          >
            Remove contains
          </button>
        )}
      </div>

      {hasContains ? (
        <>
          <SchemaNodeEditor
            label="contains"
            schema={schema.contains as JSONSchema}
            onChange={(nextContainsSchema) => {
              const next = cloneSchema(schema);
              next.contains = nextContainsSchema;
              onChange(next);
            }}
          />

          <div className="raf-builder-grid">
            <TextInput
              label="minContains"
              value={numberOrEmpty(schema.minContains)}
              onChange={(value) => onChange(assignOptionalInteger(schema, "minContains", value))}
              type="number"
              step="1"
              placeholder="e.g. 1"
            />
            <TextInput
              label="maxContains"
              value={numberOrEmpty(schema.maxContains)}
              onChange={(value) => onChange(assignOptionalInteger(schema, "maxContains", value))}
              type="number"
              step="1"
              placeholder="e.g. 3"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function CombinationEditor({
  kind,
  schema,
  onChange
}: {
  kind: SchemaCombinationKey;
  schema: JSONSchema;
  onChange: (next: JSONSchema) => void;
}) {
  const entries = (Array.isArray(schema[kind]) ? schema[kind] : []) as JSONSchema[];

  return (
    <div className="raf-builder-block">
      <h4 className="raf-builder-heading">{kind}</h4>

      <div className="raf-button-row">
        <button
          className="raf-button raf-button-primary"
          type="button"
          onClick={() => {
            const next = cloneSchema(schema);
            const currentEntries = (Array.isArray(next[kind]) ? next[kind] : []) as JSONSchema[];
            next[kind] = [...currentEntries, { type: "string" }];
            onChange(next);
          }}
        >
          Add {kind} Entry
        </button>

        {entries.length > 0 ? (
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              delete next[kind];
              onChange(next);
            }}
          >
            Clear {kind}
          </button>
        ) : null}
      </div>

      {entries.map((entrySchema, index) => (
        <SchemaNodeEditor
          key={`${kind}-${index}`}
          label={`${kind}[${index}]`}
          schema={entrySchema}
          onChange={(nextEntrySchema) => {
            const next = cloneSchema(schema);
            const currentEntries = (Array.isArray(next[kind]) ? next[kind] : []) as JSONSchema[];
            currentEntries[index] = nextEntrySchema;
            next[kind] = currentEntries;
            onChange(next);
          }}
          onRemove={() => {
            const next = cloneSchema(schema);
            const currentEntries = (Array.isArray(next[kind]) ? next[kind] : []) as JSONSchema[];
            currentEntries.splice(index, 1);
            next[kind] = currentEntries;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function TypeListEditor({
  value,
  onChange
}: {
  value: JSONSchemaType[];
  onChange: (nextTypes: JSONSchemaType[]) => void;
}) {
  const availableTypes = FIELD_TYPES.filter((type) => !value.includes(type));

  return (
    <div className="raf-field">
      <div className="raf-field-label-row">
        <span className="raf-field-label">Types</span>
      </div>

      {value.map((type, index) => (
        <div className="raf-button-row" key={`type-${index}`}>
          <select
            className="raf-select raf-builder-control"
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as JSONSchemaType;
              if (nextType === type || value.includes(nextType)) {
                return;
              }

              const nextTypes = [...value];
              nextTypes[index] = nextType;
              onChange(nextTypes);
            }}
          >
            {FIELD_TYPES.map((optionType) => (
              <option key={optionType} value={optionType}>
                {optionType}
              </option>
            ))}
          </select>

          {value.length > 1 ? (
            <button
              className="raf-button raf-button-danger"
              type="button"
              onClick={() => {
                const nextTypes = value.filter((_, currentIndex) => currentIndex !== index);
                onChange(nextTypes);
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}

      <div className="raf-button-row">
        <button
          className="raf-button raf-button-secondary"
          type="button"
          disabled={availableTypes.length === 0}
          onClick={() => {
            if (availableTypes.length === 0) {
              return;
            }

            onChange([...value, availableTypes[0]]);
          }}
        >
          Add Type
        </button>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  type = "text",
  step
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="raf-field">
      <div className="raf-field-label-row">
        <span className="raf-field-label">{label}</span>
      </div>
      <input
        className="raf-input raf-builder-control"
        type={type}
        value={value}
        placeholder={placeholder}
        step={step}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText ? <div className="raf-muted">{helperText}</div> : null}
    </label>
  );
}

function TextAreaInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="raf-field">
      <div className="raf-field-label-row">
        <span className="raf-field-label">{label}</span>
      </div>
      <textarea
        className="raf-textarea raf-builder-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function createDefaultRootSchema(): JSONSchema {
  return {
    $schema: DEFAULT_SCHEMA_URI,
    title: "New Schema",
    type: "object",
    properties: {},
    required: []
  };
}

function applyTypes(schema: JSONSchema, nextTypesInput: JSONSchemaType[]): JSONSchema {
  const next = cloneSchema(schema);
  const previousTypes = getSchemaTypes(next);
  const nextTypes = normalizeTypes(nextTypesInput);
  const removedTypes = previousTypes.filter((type) => !nextTypes.includes(type));

  for (const removedType of removedTypes) {
    removeTypeSpecificKeywords(next, removedType, nextTypes);
  }

  next.type = nextTypes.length === 1 ? nextTypes[0] : nextTypes;

  if (nextTypes.includes("object")) {
    next.properties = next.properties ?? {};
    next.required = Array.isArray(next.required) ? next.required : [];
  }

  if (nextTypes.includes("array")) {
    next.items = next.items ?? { type: "string" };
  }

  return next;
}

function removeTypeSpecificKeywords(schema: JSONSchema, type: JSONSchemaType, activeTypes: JSONSchemaType[]): void {
  if (type === "object") {
    if (!activeTypes.includes("object")) {
      delete schema.properties;
      delete schema.required;
      delete schema.additionalProperties;
    }
    return;
  }

  if (type === "array") {
    if (!activeTypes.includes("array")) {
      delete schema.items;
      delete schema.contains;
      delete schema.minItems;
      delete schema.maxItems;
      delete schema.uniqueItems;
      delete schema.minContains;
      delete schema.maxContains;
    }
    return;
  }

  if (type === "string") {
    if (!activeTypes.includes("string")) {
      delete schema.pattern;
    }
    return;
  }

  if (type === "number" || type === "integer") {
    if (!(activeTypes.includes("number") || activeTypes.includes("integer"))) {
      delete schema.minimum;
      delete schema.maximum;
    }
  }
}

function getSchemaTypes(schema: JSONSchema): JSONSchemaType[] {
  if (Array.isArray(schema.type)) {
    return normalizeTypes(schema.type as JSONSchemaType[]);
  }

  if (typeof schema.type === "string") {
    return normalizeTypes([schema.type as JSONSchemaType]);
  }

  return ["object"];
}

function normalizeTypes(types: JSONSchemaType[]): JSONSchemaType[] {
  const normalized: JSONSchemaType[] = [];

  for (const type of types) {
    if (!FIELD_TYPES.includes(type)) {
      continue;
    }

    if (!normalized.includes(type)) {
      normalized.push(type);
    }
  }

  return normalized.length > 0 ? normalized : ["string"];
}

function assignOptionalString<T extends keyof JSONSchema>(schema: JSONSchema, key: T, value: string): JSONSchema {
  const next = cloneSchema(schema);

  if (value.trim() === "") {
    delete next[key];
    return next;
  }

  next[key] = value;
  return next;
}

function assignOptionalNumber<T extends keyof JSONSchema>(schema: JSONSchema, key: T, value: string): JSONSchema {
  const next = cloneSchema(schema);

  if (value.trim() === "") {
    delete next[key];
    return next;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return next;
  }

  next[key] = parsed;
  return next;
}

function assignOptionalInteger<T extends keyof JSONSchema>(schema: JSONSchema, key: T, value: string): JSONSchema {
  const next = cloneSchema(schema);

  if (value.trim() === "") {
    delete next[key];
    return next;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return next;
  }

  next[key] = parsed;
  return next;
}

function createUniquePropertyName(properties: Record<string, JSONSchema>, baseName: string): string {
  if (!properties[baseName]) {
    return baseName;
  }

  let index = 1;
  while (properties[`${baseName}${index}`]) {
    index += 1;
  }
  return `${baseName}${index}`;
}

function cloneSchema<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeSchemaForOutput(schema: JSONSchema): JSONSchema {
  const next = cloneSchema(schema);

  if (next.properties) {
    const sanitizedProperties: Record<string, JSONSchema> = {};

    for (const [propertyName, propertySchema] of Object.entries(next.properties)) {
      if (propertyName.trim() === "") {
        continue;
      }

      sanitizedProperties[propertyName] = sanitizeSchemaForOutput(propertySchema);
    }

    next.properties = sanitizedProperties;
  }

  if (Array.isArray(next.required)) {
    next.required = next.required.filter((entry) => entry.trim() !== "");
  }

  if (Array.isArray(next.items)) {
    next.items = next.items.map((itemSchema) => sanitizeSchemaForOutput(itemSchema));
  } else if (isObject(next.items)) {
    next.items = sanitizeSchemaForOutput(next.items as JSONSchema);
  }

  if (isObject(next.contains)) {
    next.contains = sanitizeSchemaForOutput(next.contains as JSONSchema);
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    if (Array.isArray(next[key])) {
      next[key] = next[key].map((entry) => sanitizeSchemaForOutput(entry));
    }
  }

  return next;
}

function applyDomainToRootId(schema: JSONSchema, domain?: string): JSONSchema {
  if (!domain) {
    return schema;
  }

  const next = cloneSchema(schema);
  const localId = stringOrEmpty(next.$id);

  if (!localId.trim()) {
    return next;
  }

  next.$id = toFullId(localId, domain);
  return next;
}

function toLocalId(value: string, domain?: string): string {
  const trimmed = value.trim();
  if (!domain || !trimmed) {
    return trimmed;
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return trimmed;
  }

  if (trimmed === normalizedDomain) {
    return "";
  }

  const domainWithSlash = `${normalizedDomain}/`;
  if (trimmed.startsWith(domainWithSlash)) {
    return trimmed.slice(domainWithSlash.length);
  }

  return trimmed;
}

function toFullId(localId: string, domain?: string): string {
  const trimmedLocal = localId.trim();
  if (!domain || !trimmedLocal) {
    return trimmedLocal;
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return trimmedLocal;
  }

  if (trimmedLocal === normalizedDomain || trimmedLocal.startsWith(`${normalizedDomain}/`)) {
    return trimmedLocal;
  }

  return `${normalizedDomain}/${trimmedLocal.replace(/^\/+/, "")}`;
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/\/+$/, "");
}

function validateSchemaDefinition(schema: JSONSchema): SchemaBuilderValidationError[] {
  try {
    const ajv = createAjvForSchema(schema);
    const valid = ajv.validateSchema(schema);

    if (valid) {
      return [];
    }

    return (ajv.errors ?? []).map((error) => ({
      message: error.message ?? "Schema validation error",
      keyword: error.keyword,
      instancePath: error.instancePath,
      schemaPath: error.schemaPath,
      source: "schema"
    }));
  } catch (error) {
    return [
      {
        message: error instanceof Error ? error.message : "Schema validation failed.",
        source: "schema"
      }
    ];
  }
}

function numberOrEmpty(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function toInlineJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
