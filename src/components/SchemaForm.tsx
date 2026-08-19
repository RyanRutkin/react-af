import { useEffect, useMemo, useRef, useState } from "react";
import type { SchemaFormProps, SchemaFormValidationError } from "../types/components";
import type { JSONSchema, OutputData } from "../types/schema";
import { createDefaultValueFromSchema } from "../utils/defaultData";
import { getValueAtPointer, setValueAtPointer } from "../utils/jsonPointer";
import { resolveSchemaRefs } from "../utils/refResolver";
import { validateDataOrThrow, validatePeerSchemasOrThrow, validateSchemaOrThrow } from "../utils/schemaValidation";
import { SchemaFieldRenderer } from "./SchemaFieldRenderer";

export function SchemaForm({ schema, peerSchemas, widgets, options, data, onChange }: SchemaFormProps) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const resolvedSchema = useMemo(() => {
    validateSchemaOrThrow(schema, "schema");
    validatePeerSchemasOrThrow(peerSchemas);
    return resolveSchemaRefs(schema, peerSchemas);
  }, [schema, peerSchemas]);

  const initialData = useMemo(() => {
    if (data !== undefined) {
      return data;
    }

    const fallback = createDefaultValueFromSchema(resolvedSchema, {
      defaults: options?.defaults ?? "all"
    });
    return fallback ?? {};
  }, [data, options?.defaults, resolvedSchema]);

  const [formData, setFormData] = useState<OutputData>(initialData);

  useEffect(() => {
    setFormData(initialData);
    const validationErrors = getDataValidationErrors(initialData, resolvedSchema);
    onChangeRef.current?.(initialData, validationErrors, "", undefined, initialData);
  }, [initialData]);

  const handleFieldChange = (pointer: string, next: unknown) => {
    const previousValue = getValueAtPointer(formData, pointer);
    const updated = setValueAtPointer(formData, pointer, next) as OutputData;
    const validationErrors = getDataValidationErrors(updated, resolvedSchema);

    setFormData(updated);
    onChangeRef.current?.(updated, validationErrors, pointer, previousValue, next);
  };

  return (
    <div className="raf-schema-form">
      <SchemaFieldRenderer
        schema={resolvedSchema}
        label={resolvedSchema.title ?? "Schema Form"}
        required={true}
        pointer=""
        schemaPointer=""
        value={formData}
        onChange={handleFieldChange}
        widgets={widgets}
      />
    </div>
  );
}

function getDataValidationErrors(data: unknown, schema: JSONSchema): SchemaFormValidationError[] {
  try {
    validateDataOrThrow(data, schema);
    return [];
  } catch (error) {
    return [
      {
        message: error instanceof Error ? error.message : "Validation error",
        source: "data"
      }
    ];
  }
}
