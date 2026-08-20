import { useEffect, useMemo, useRef, useState } from "react";
import type { SchemaBuilderProps, SchemaBuilderValidationError } from "../types/components";
import type { JSONSchema, JSONSchemaType } from "../types/schema";
import { AJV_SUPPORTED_FORMATS, createAjvForSchema } from "../utils/schemaValidation";

type SchemaCombinationKey = "allOf" | "anyOf" | "oneOf";
type SchemaConditionalKey = "if" | "then" | "else";

const FIELD_TYPES: JSONSchemaType[] = ["string", "number", "integer", "boolean", "object", "array", "null"];

const DEFAULT_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema";

export function SchemaBuilder({ schema, domain, onChange }: SchemaBuilderProps) {
  const [currentSchema, setCurrentSchema] = useState<JSONSchema>(() => schema ?? createDefaultRootSchema());
  const [rawJson, setRawJson] = useState(() => JSON.stringify(schema ?? createDefaultRootSchema(), null, 2));
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  const publishedSchema = useMemo(() => {
    const sanitized = sanitizeSchemaForOutput(currentSchema);
    return applyDomainToRootId(sanitized, domain);
  }, [currentSchema, domain]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (schema) {
      setCurrentSchema(cloneSchema(schema));
    }
  }, [schema]);

  useEffect(() => {
    setRawJson(JSON.stringify(currentSchema, null, 2));
    const validationErrors = validateSchemaDefinition(publishedSchema);
    onChangeRef.current?.(publishedSchema, validationErrors);
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
                  onChangeRef.current?.(publishedSchema, [
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
                onChangeRef.current?.(publishedSchema, [
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
  const primaryType = schemaTypes.length === 1 ? schemaTypes[0] : undefined;
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
            onChange={(nextTypes) => {
              const next = applyTypes(schema, nextTypes);
              delete next.const;
              delete next.enum;
              onChange(next);
            }}
          />
          <JsonTextInput
            label="Default (JSON)"
            value={schema.default}
            placeholder='e.g. "abc", 42, true, {"k":"v"}'
            onClear={() => {
              const next = cloneSchema(schema);
              delete next.default;
              onChange(next);
            }}
            onValidJson={(parsed) => {
              onChange({ ...schema, default: parsed });
            }}
          />
        </div>

        <ConstEditor schema={schema} schemaTypes={schemaTypes} primaryType={primaryType} onChange={onChange} />

        <EnumEditor schema={schema} schemaTypes={schemaTypes} primaryType={primaryType} onChange={onChange} />

        {hasType("string") ? (
          <>
            <div className="raf-builder-grid">
              <TextInput
                label="minLength"
                value={numberOrEmpty(schema.minLength)}
                onChange={(value) => onChange(assignOptionalInteger(schema, "minLength", value))}
                type="number"
                step="1"
                placeholder="e.g. 1"
              />
              <TextInput
                label="maxLength"
                value={numberOrEmpty(schema.maxLength)}
                onChange={(value) => onChange(assignOptionalInteger(schema, "maxLength", value))}
                type="number"
                step="1"
                placeholder="e.g. 255"
              />
            </div>
            <TextInput
              label="Pattern"
              value={stringOrEmpty(schema.pattern)}
              onChange={(value) => onChange(assignOptionalString(schema, "pattern", value))}
              placeholder="e.g. ^[A-Za-z]+$"
            />
            <TypeaheadInput
              label="format"
              value={stringOrEmpty(schema.format)}
              onChange={(value) => onChange(assignOptionalString(schema, "format", value))}
              options={AJV_SUPPORTED_FORMATS}
              placeholder="e.g. email"
            />
          </>
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
        <ConditionalSchemaEditor kind="if" schema={schema} onChange={onChange} />
        <ConditionalSchemaEditor kind="then" schema={schema} onChange={onChange} />
        <ConditionalSchemaEditor kind="else" schema={schema} onChange={onChange} />

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
  const tupleItems = Array.isArray(schema.prefixItems)
    ? schema.prefixItems
    : Array.isArray(schema.items)
      ? schema.items
      : undefined;
  const items = !Array.isArray(schema.items) && isObject(schema.items) ? schema.items : undefined;
  const hasContains = isObject(schema.contains);

  return (
    <div className="raf-builder-block">
      {tupleItems ? (
        <>
          <h4 className="raf-builder-heading">Array Items (Tuple)</h4>
          <div className="raf-button-row">
            <button
              className="raf-button raf-button-primary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.prefixItems)
                  ? [...next.prefixItems]
                  : Array.isArray(next.items)
                    ? [...next.items]
                    : [];
                nextItems.push({ type: "string" });
                next.prefixItems = nextItems;
                next.items = false;
                onChange(next);
              }}
            >
              Add Tuple Item Schema
            </button>
          </div>

          {tupleItems.map((itemSchema, index) => (
            <SchemaNodeEditor
              key={`tuple-item-${index}`}
              label={`Tuple Item ${index + 1}`}
              schema={itemSchema}
              onChange={(nextItemSchema) => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.prefixItems)
                  ? [...next.prefixItems]
                  : Array.isArray(next.items)
                    ? [...next.items]
                    : [];
                nextItems[index] = nextItemSchema;
                next.prefixItems = nextItems;
                next.items = false;
                onChange(next);
              }}
              onRemove={() => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.prefixItems)
                  ? [...next.prefixItems]
                  : Array.isArray(next.items)
                    ? [...next.items]
                    : [];
                nextItems.splice(index, 1);
                next.prefixItems = nextItems;
                next.items = false;
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
                delete next.prefixItems;
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
              delete next.prefixItems;
              onChange(next);
            }}
          />

          <div className="raf-button-row">
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                next.prefixItems = [{ type: "string" }];
                next.items = false;
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

function ConditionalSchemaEditor({
  kind,
  schema,
  onChange
}: {
  kind: SchemaConditionalKey;
  schema: JSONSchema;
  onChange: (next: JSONSchema) => void;
}) {
  const entry = isObject(schema[kind]) ? (schema[kind] as JSONSchema) : undefined;

  return (
    <div className="raf-builder-block">
      <h4 className="raf-builder-heading">{kind}</h4>

      <div className="raf-button-row">
        {!entry ? (
          <button
            className="raf-button raf-button-primary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              next[kind] = { type: "string" };
              onChange(next);
            }}
          >
            Add {kind}
          </button>
        ) : (
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
        )}
      </div>

      {entry ? (
        <SchemaNodeEditor
          label={kind}
          schema={entry}
          onChange={(nextEntrySchema) => {
            const next = cloneSchema(schema);
            next[kind] = nextEntrySchema;
            onChange(next);
          }}
          onRemove={() => {
            const next = cloneSchema(schema);
            delete next[kind];
            onChange(next);
          }}
        />
      ) : null}
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

function TypeaheadInput({
  label,
  value,
  onChange,
  options,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLLabelElement | null>(null);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    normalizedValue === "" ? true : option.toLowerCase().startsWith(normalizedValue)
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <label className="raf-field raf-typeahead" ref={containerRef}>
      <div className="raf-field-label-row">
        <span className="raf-field-label">{label}</span>
      </div>
      <input
        className="raf-input raf-builder-control"
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => {
          setIsOpen(true);
          onChange(event.target.value);
        }}
      />
      {isOpen && filteredOptions.length > 0 ? (
        <div className="raf-typeahead-menu" role="listbox" aria-label={`${label} options`}>
          {filteredOptions.map((option) => (
            <button
              key={option}
              className="raf-typeahead-option"
              type="button"
              role="option"
              aria-selected={value === option}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
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

function JsonTextInput({
  label,
  value,
  onValidJson,
  onClear,
  onInvalidJsonText,
  stringValueDisplay = "json",
  placeholder
}: {
  label: string;
  value: unknown;
  onValidJson: (parsed: unknown) => void;
  onClear: () => void;
  onInvalidJsonText?: (rawText: string) => void;
  stringValueDisplay?: "json" | "raw";
  placeholder?: string;
}) {
  const serializedValue =
    value === undefined
      ? ""
      : stringValueDisplay === "raw" && typeof value === "string"
        ? value
        : toInlineJson(value);
  const [draftValue, setDraftValue] = useState(serializedValue);

  useEffect(() => {
    setDraftValue(serializedValue);
  }, [serializedValue]);

  return (
    <TextInput
      label={label}
      value={draftValue}
      onChange={(nextText) => {
        setDraftValue(nextText);

        if (nextText.trim() === "") {
          onClear();
          return;
        }

        try {
          const parsed = JSON.parse(nextText);
          onValidJson(parsed);
        } catch {
          onInvalidJsonText?.(nextText);
        }
      }}
      placeholder={placeholder}
    />
  );
}

function ConstEditor({
  schema,
  schemaTypes,
  primaryType,
  onChange
}: {
  schema: JSONSchema;
  schemaTypes: JSONSchemaType[];
  primaryType?: JSONSchemaType;
  onChange: (next: JSONSchema) => void;
}) {
  if (primaryType === "null" && schemaTypes.length === 1) {
    return null;
  }

  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;

  if (enumValues && enumValues.length > 0) {
    const selectedIndex = enumValues.findIndex((entry) => deepEqual(entry, schema.const));

    return (
      <label className="raf-field">
        <div className="raf-field-label-row">
          <span className="raf-field-label">Const</span>
        </div>
        <select
          className="raf-select raf-builder-control"
          value={selectedIndex >= 0 ? String(selectedIndex) : ""}
          onChange={(event) => {
            const indexValue = event.target.value;
            const next = cloneSchema(schema);

            if (indexValue === "") {
              delete next.const;
              onChange(next);
              return;
            }

            const index = Number(indexValue);
            if (!Number.isInteger(index) || index < 0 || index >= enumValues.length) {
              return;
            }

            next.const = cloneSchema(enumValues[index]);
            onChange(next);
          }}
        >
          <option value="">None</option>
          {enumValues.map((option, index) => (
            <option key={`${index}-${String(option)}`} value={String(index)}>
              {String(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (primaryType === "boolean") {
    return (
      <label className="raf-checkbox-row">
        <input
          className="raf-checkbox"
          type="checkbox"
          checked={schema.const === true}
          onChange={(event) => {
            const next = cloneSchema(schema);
            next.const = event.target.checked;
            onChange(next);
          }}
        />
        <span>Const</span>
      </label>
    );
  }

  if (primaryType === "number" || primaryType === "integer") {
    return (
      <TextInput
        label="Const"
        type="number"
        step={primaryType === "integer" ? "1" : "any"}
        value={typeof schema.const === "number" ? String(schema.const) : ""}
        placeholder={primaryType === "integer" ? "e.g. 3" : "e.g. 3.14"}
        onChange={(value) => {
          const next = cloneSchema(schema);

          if (value.trim() === "") {
            delete next.const;
            onChange(next);
            return;
          }

          const parsed = Number(value);
          if (!Number.isFinite(parsed)) {
            return;
          }

          if (primaryType === "integer" && !Number.isInteger(parsed)) {
            return;
          }

          next.const = parsed;
          onChange(next);
        }}
      />
    );
  }

  if (primaryType === "string") {
    return (
      <TextInput
        label="Const"
        type="text"
        value={typeof schema.const === "string" ? schema.const : ""}
        placeholder="e.g. fixed-value"
        onChange={(value) => {
          const next = cloneSchema(schema);
          if (value === "") {
            delete next.const;
          } else {
            next.const = value;
          }
          onChange(next);
        }}
      />
    );
  }

  if (!primaryType) {
    return (
      <JsonTextInput
        label="Const"
        value={schema.const}
        stringValueDisplay="raw"
        placeholder="e.g. A, 2, true, null"
        onClear={() => {
          const next = cloneSchema(schema);
          delete next.const;
          onChange(next);
        }}
        onValidJson={(parsed) => {
          if (!matchesAnySchemaType(parsed, schemaTypes)) {
            return;
          }

          onChange({ ...schema, const: parsed });
        }}
        onInvalidJsonText={(rawText) => {
          const parsed = parseLooseScalarByTypes(rawText, schemaTypes);
          if (parsed === undefined) {
            return;
          }

          onChange({ ...schema, const: parsed });
        }}
      />
    );
  }

  return (
    <JsonTextInput
      label="Const (JSON)"
      value={schema.const}
      placeholder='e.g. "fixed-value", 3, true, null, {"k":"v"}'
      onClear={() => {
        const next = cloneSchema(schema);
        delete next.const;
        onChange(next);
      }}
      onValidJson={(parsed) => {
        onChange({ ...schema, const: parsed });
      }}
    />
  );
}

function EnumEditor({
  schema,
  schemaTypes,
  primaryType,
  onChange
}: {
  schema: JSONSchema;
  schemaTypes: JSONSchemaType[];
  primaryType?: JSONSchemaType;
  onChange: (next: JSONSchema) => void;
}) {
  if (primaryType === "boolean" || primaryType === "null") {
    return null;
  }

  if (primaryType === "string") {
    return (
      <StringEnumInput
        value={Array.isArray(schema.enum) ? schema.enum : undefined}
        onChange={(nextEnum) => {
          const next = cloneSchema(schema);
          delete next.const;

          if (!nextEnum || nextEnum.length === 0) {
            delete next.enum;
          } else {
            next.enum = nextEnum;
          }

          onChange(next);
        }}
      />
    );
  }

  if (primaryType === "number" || primaryType === "integer") {
    return (
      <NumberEnumInput
        value={Array.isArray(schema.enum) ? schema.enum : undefined}
        integerOnly={primaryType === "integer"}
        onChange={(nextEnum) => {
          const next = cloneSchema(schema);
          delete next.const;

          if (!nextEnum || nextEnum.length === 0) {
            delete next.enum;
          } else {
            next.enum = nextEnum;
          }

          onChange(next);
        }}
      />
    );
  }

  if (!primaryType && schemaTypes.length > 1) {
    return (
      <StringEnumInput
        value={Array.isArray(schema.enum) ? schema.enum : undefined}
        parseEntry={(entry) => parseLooseScalarByTypes(entry, schemaTypes)}
        onChange={(nextEnum) => {
          const next = cloneSchema(schema);
          delete next.const;

          if (!nextEnum || nextEnum.length === 0) {
            delete next.enum;
          } else {
            next.enum = nextEnum;
          }

          onChange(next);
        }}
      />
    );
  }

  return null;
}

function NumberEnumInput({
  value,
  integerOnly,
  onChange
}: {
  value?: unknown[];
  integerOnly: boolean;
  onChange: (nextEnum: number[] | undefined) => void;
}) {
  const serializedValue = Array.isArray(value) ? JSON.stringify(value) : "";
  const [draftValue, setDraftValue] = useState(serializedValue);
  const lastSubmittedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const nextSignature = Array.isArray(value) ? JSON.stringify(value) : "";
    if (lastSubmittedSignatureRef.current === nextSignature) {
      return;
    }

    setDraftValue(serializedValue);
  }, [serializedValue, value]);

  return (
    <TextInput
      label="Enum"
      value={draftValue}
      placeholder={integerOnly ? "e.g. [1, 2, 3]" : "e.g. [1, 2.5, 3]"}
      onChange={(nextText) => {
        if (!/^[\[\]\d,\.\-+\seE]*$/.test(nextText)) {
          return;
        }

        setDraftValue(nextText);

        if (nextText.trim() === "") {
          lastSubmittedSignatureRef.current = "";
          onChange(undefined);
          return;
        }

        const parsed = parseNumberEnum(nextText, integerOnly);
        if (!parsed) {
          return;
        }

        lastSubmittedSignatureRef.current = JSON.stringify(parsed);
        onChange(parsed);
      }}
    />
  );
}


function parseNumberEnum(input: string, integerOnly: boolean): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const hasWrappedBrackets = trimmed.startsWith("[") && trimmed.endsWith("]");
  const core = hasWrappedBrackets ? trimmed.slice(1, -1) : trimmed;

  if (core.trim() === "") {
    return [];
  }

  const segments = core.split(",").map((entry) => entry.trim());
  if (segments.some((entry) => entry === "")) {
    return null;
  }

  const parsedValues: number[] = [];
  for (const segment of segments) {
    const parsed = Number(segment);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    if (integerOnly && !Number.isInteger(parsed)) {
      return null;
    }

    parsedValues.push(parsed);
  }

  return parsedValues;
}
function StringEnumInput({
  value,
  parseEntry,
  onChange
}: {
  value?: unknown[];
  parseEntry?: (entry: string) => unknown | undefined;
  onChange: (nextEnum: unknown[] | undefined) => void;
}) {
  const displayValues = Array.isArray(value) ? value.map((entry) => (typeof entry === "string" ? entry : String(entry))) : [];
  const serializedValue = Array.isArray(value) ? serializeStringEnum(displayValues) : "";
  const [draftValue, setDraftValue] = useState(serializedValue);
  const lastSubmittedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const nextSignature = Array.isArray(value) ? JSON.stringify(displayValues) : "";
    if (lastSubmittedSignatureRef.current === nextSignature) {
      return;
    }

    setDraftValue(serializedValue);
  }, [serializedValue, value]);

  return (
    <TextInput
      label="Enum"
      type="text"
      value={draftValue}
      placeholder={`e.g. A, B, "C, D", 'E, F'`}
      onChange={(nextText) => {
        setDraftValue(nextText);

        if (nextText.trim() === "") {
          lastSubmittedSignatureRef.current = "";
          onChange(undefined);
          return;
        }

        const parsed = parseStringEnum(nextText);
        if (!parsed.valid || !parsed.values) {
          return;
        }

        const normalizedValues = parsed.values.map((entry) => {
          if (!parseEntry) {
            return entry;
          }

          return parseEntry(entry);
        });

        if (normalizedValues.some((entry) => entry === undefined)) {
          return;
        }

        const typedValues = normalizedValues as unknown[];
        const submittedSignature = JSON.stringify(
          typedValues.map((entry) => (typeof entry === "string" ? entry : String(entry)))
        );
        lastSubmittedSignatureRef.current = submittedSignature;
        onChange(typedValues);
      }}
    />
  );
}

function parseLooseScalarByTypes(value: string, schemaTypes: JSONSchemaType[]): unknown | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  if (schemaTypes.includes("boolean")) {
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
  }

  if (schemaTypes.includes("null") && trimmed === "null") {
    return null;
  }

  if (schemaTypes.includes("integer")) {
    const parsedInteger = Number(trimmed);
    if (Number.isInteger(parsedInteger)) {
      return parsedInteger;
    }
  }

  if (schemaTypes.includes("number")) {
    const parsedNumber = Number(trimmed);
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber;
    }
  }

  if (schemaTypes.includes("string")) {
    return value;
  }

  return undefined;
}

function parseStringEnum(input: string): { valid: boolean; values: string[] | null } {
  const values: string[] = [];
  let token = "";
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let tokenUsedQuotes = false;
  let tokenClosedQuote = false;

  const pushToken = () => {
    const candidate = tokenUsedQuotes ? token : token.trim();
    if (candidate.length > 0) {
      values.push(candidate);
    }

    token = "";
    tokenUsedQuotes = false;
    tokenClosedQuote = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inDoubleQuote) {
      if (char === '"') {
        if (token.endsWith("/")) {
          token = `${token.slice(0, -1)}"`;
          continue;
        }

        inDoubleQuote = false;
        tokenClosedQuote = true;
        continue;
      }

      token += char;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        if (token.endsWith("/")) {
          token = `${token.slice(0, -1)}'`;
          continue;
        }

        inSingleQuote = false;
        tokenClosedQuote = true;
        continue;
      }

      token += char;
      continue;
    }

    if (char === ",") {
      pushToken();
      continue;
    }

    if (char === '"') {
      if (token.trim().length === 0) {
        token = "";
      }
      inDoubleQuote = true;
      tokenUsedQuotes = true;
      continue;
    }

    if (char === "'") {
      if (token.trim().length === 0) {
        token = "";
      }
      inSingleQuote = true;
      tokenUsedQuotes = true;
      continue;
    }

    if (tokenClosedQuote && /\s/.test(char)) {
      continue;
    }

    token += char;
  }

  if (inDoubleQuote || inSingleQuote) {
    return { valid: false, values: null };
  }

  pushToken();

  return { valid: true, values };
}

function serializeStringEnum(values: string[]): string {
  return values
    .map((value) => {
      const needsQuotes = value === "" || /[\s,\"']/.test(value);
      if (!needsQuotes) {
        return value;
      }

      const escaped = value.replace(/\"/g, '/"');
      return `"${escaped}"`;
    })
    .join(", ");
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
    next.prefixItems = next.items.map((itemSchema) => sanitizeSchemaForOutput(itemSchema));
    next.items = false;
  }

  if (Array.isArray(next.prefixItems)) {
    next.prefixItems = next.prefixItems.map((itemSchema) => sanitizeSchemaForOutput(itemSchema));
  } else if (isObject(next.items)) {
    next.items = sanitizeSchemaForOutput(next.items as JSONSchema);
  }

  if (isObject(next.contains)) {
    next.contains = sanitizeSchemaForOutput(next.contains as JSONSchema);
  }

  for (const key of ["if", "then", "else"] as const) {
    if (isObject(next[key])) {
      next[key] = sanitizeSchemaForOutput(next[key] as JSONSchema);
    }
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
  const consistencyErrors = validateConstAndEnumConsistency(schema);

  try {
    const ajv = createAjvForSchema(schema);
    const valid = ajv.validateSchema(schema);

    const schemaErrors: SchemaBuilderValidationError[] = valid
      ? []
      : (ajv.errors ?? []).map((error) => ({
          message: error.message ?? "Schema validation error",
          keyword: error.keyword,
          instancePath: error.instancePath,
          schemaPath: error.schemaPath,
          source: "schema" as const
        }));

    return [...schemaErrors, ...consistencyErrors];
  } catch (error) {
    return [
      {
        message: error instanceof Error ? error.message : "Schema validation failed.",
        source: "schema"
      },
      ...consistencyErrors
    ];
  }
}

function validateConstAndEnumConsistency(schema: JSONSchema, schemaPointer = ""): SchemaBuilderValidationError[] {
  const errors: SchemaBuilderValidationError[] = [];
  const schemaTypes = getSchemaTypes(schema);
  const hasConst = Object.prototype.hasOwnProperty.call(schema, "const");

  if (hasConst && !matchesAnySchemaType(schema.const, schemaTypes)) {
    errors.push({
      message: "const value does not match the field type.",
      keyword: "const",
      instancePath: schemaPointer,
      schemaPath: `${schemaPointer}/const`,
      source: "schema"
    });
  }

  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum)) {
      errors.push({
        message: "enum must be an array.",
        keyword: "enum",
        instancePath: schemaPointer,
        schemaPath: `${schemaPointer}/enum`,
        source: "schema"
      });
    } else {
      schema.enum.forEach((enumValue, index) => {
        if (!matchesAnySchemaType(enumValue, schemaTypes)) {
          errors.push({
            message: `enum value at index ${index} does not match the field type.`,
            keyword: "enum",
            instancePath: schemaPointer,
            schemaPath: `${schemaPointer}/enum/${index}`,
            source: "schema"
          });
        }
      });

      if (hasConst && !schema.enum.some((entry) => deepEqual(entry, schema.const))) {
        errors.push({
          message: "const value must exist in enum when both are provided.",
          keyword: "const",
          instancePath: schemaPointer,
          schemaPath: `${schemaPointer}/const`,
          source: "schema"
        });
      }
    }
  }

  if (schema.properties) {
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      errors.push(
        ...validateConstAndEnumConsistency(
          propertySchema,
          `${schemaPointer}/properties/${escapeJsonPointerToken(propertyName)}`
        )
      );
    }
  }

  if (Array.isArray(schema.items)) {
    schema.items.forEach((itemSchema, index) => {
      errors.push(...validateConstAndEnumConsistency(itemSchema, `${schemaPointer}/items/${index}`));
    });
  } else if (isObject(schema.items)) {
    errors.push(...validateConstAndEnumConsistency(schema.items as JSONSchema, `${schemaPointer}/items`));
  }

  if (isObject(schema.contains)) {
    errors.push(...validateConstAndEnumConsistency(schema.contains as JSONSchema, `${schemaPointer}/contains`));
  }

  for (const key of ["if", "then", "else"] as const) {
    if (isObject(schema[key])) {
      errors.push(...validateConstAndEnumConsistency(schema[key] as JSONSchema, `${schemaPointer}/${key}`));
    }
  }

  for (const combinatorKey of ["allOf", "anyOf", "oneOf"] as const) {
    const entries = schema[combinatorKey];
    if (!Array.isArray(entries)) {
      continue;
    }

    entries.forEach((entry, index) => {
      errors.push(...validateConstAndEnumConsistency(entry, `${schemaPointer}/${combinatorKey}/${index}`));
    });
  }

  return errors;
}

function matchesAnySchemaType(value: unknown, schemaTypes: JSONSchemaType[]): boolean {
  return schemaTypes.some((schemaType) => matchesSchemaType(value, schemaType));
}

function matchesSchemaType(value: unknown, schemaType: JSONSchemaType): boolean {
  if (schemaType === "string") {
    return typeof value === "string";
  }

  if (schemaType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (schemaType === "integer") {
    return typeof value === "number" && Number.isInteger(value);
  }

  if (schemaType === "boolean") {
    return typeof value === "boolean";
  }

  if (schemaType === "null") {
    return value === null;
  }

  if (schemaType === "array") {
    return Array.isArray(value);
  }

  return isObject(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((entry, index) => deepEqual(entry, b[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

function escapeJsonPointerToken(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
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
