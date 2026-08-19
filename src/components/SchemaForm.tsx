import { useEffect, useMemo, useRef, useState } from "react";
import type { SchemaFormProps, SchemaFormValidationError } from "../types/components";
import type { OutputData } from "../types/schema";
import { createDefaultValueFromSchema } from "../utils/defaultData";
import { getValueAtPointer, setValueAtPointer } from "../utils/jsonPointer";
import { resolveSchemaRefs } from "../utils/refResolver";
import { validateDataOrThrow, validatePeerSchemasOrThrow, validateSchemaOrThrow } from "../utils/schemaValidation";
import { SchemaFieldRenderer } from "./SchemaFieldRenderer";

export function SchemaForm({ schema, peerSchemas, widgets, options, data, onChange, onValidationError }: SchemaFormProps) {
  const onChangeRef = useRef(onChange);
  const onValidationErrorRef = useRef(onValidationError);

  useEffect(() => {
    onChangeRef.current = onChange;
    onValidationErrorRef.current = onValidationError;
  }, [onChange, onValidationError]);

  const resolvedSchema = useMemo(() => {
    try {
      validateSchemaOrThrow(schema, "schema");
    } catch (error) {
      emitValidationErrorDeferred(onValidationErrorRef.current, "schema", error);
      throw error;
    }

    try {
      validatePeerSchemasOrThrow(peerSchemas);
    } catch (error) {
      emitValidationErrorDeferred(onValidationErrorRef.current, "peerSchemas", error);
      throw error;
    }

    try {
      return resolveSchemaRefs(schema, peerSchemas);
    } catch (error) {
      emitValidationErrorDeferred(onValidationErrorRef.current, "ref-resolution", error);
      throw error;
    }
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
    if (data === undefined) {
      return;
    }

    try {
      validateDataOrThrow(data, resolvedSchema);
    } catch (error) {
      emitValidationError(onValidationErrorRef.current, "data", error);
    }
  }, [data, resolvedSchema]);

  useEffect(() => {
    setFormData(initialData);
    onChangeRef.current?.(initialData, "", undefined, initialData);
  }, [initialData]);

  const handleFieldChange = (pointer: string, next: unknown) => {
    const previousValue = getValueAtPointer(formData, pointer);
    const updated = setValueAtPointer(formData, pointer, next) as OutputData;

    try {
      validateDataOrThrow(updated, resolvedSchema);
    } catch (error) {
      emitValidationError(onValidationErrorRef.current, "data", error);
    }

    setFormData(updated);
    onChangeRef.current?.(updated, pointer, previousValue, next);
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

function emitValidationError(
  callback: ((errors: SchemaFormValidationError[]) => void) | undefined,
  source: SchemaFormValidationError["source"],
  error: unknown
): void {
  if (!callback) {
    return;
  }

  callback([
    {
      message: error instanceof Error ? error.message : "Validation error",
      source
    }
  ]);
}

function emitValidationErrorDeferred(
  callback: ((errors: SchemaFormValidationError[]) => void) | undefined,
  source: SchemaFormValidationError["source"],
  error: unknown
): void {
  if (!callback) {
    return;
  }

  queueMicrotask(() => {
    callback([
      {
        message: error instanceof Error ? error.message : "Validation error",
        source
      }
    ]);
  });
}
