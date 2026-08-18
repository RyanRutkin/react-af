import { useEffect, useMemo, useState } from "react";
import type { SchemaFormProps } from "../types/components";
import type { OutputData } from "../types/schema";
import { createDefaultValueFromSchema } from "../utils/defaultData";
import { getValueAtPointer, setValueAtPointer } from "../utils/jsonPointer";
import { resolveSchemaRefs } from "../utils/refResolver";
import { validateDataOrThrow, validatePeerSchemasOrThrow, validateSchemaOrThrow } from "../utils/schemaValidation";
import { SchemaFieldRenderer } from "./SchemaFieldRenderer";

export function SchemaForm({ schema, peerSchemas, widgets, data, onChange }: SchemaFormProps) {
  const resolvedSchema = useMemo(() => {
    validateSchemaOrThrow(schema, "schema");
    validatePeerSchemasOrThrow(peerSchemas);
    return resolveSchemaRefs(schema, peerSchemas);
  }, [schema, peerSchemas]);

  const initialData = useMemo(() => {
    if (data !== undefined) {
      validateDataOrThrow(data, resolvedSchema);
      return data;
    }

    const fallback = createDefaultValueFromSchema(resolvedSchema);
    return fallback ?? {};
  }, [data, resolvedSchema]);

  const [formData, setFormData] = useState<OutputData>(initialData);

  useEffect(() => {
    setFormData(initialData);
    onChange?.(initialData, "", undefined, initialData);
  }, [initialData]);

  const handleFieldChange = (pointer: string, next: unknown) => {
    const previousValue = getValueAtPointer(formData, pointer);
    const updated = setValueAtPointer(formData, pointer, next) as OutputData;
    setFormData(updated);
    onChange?.(updated, pointer, previousValue, next);
  };

  return (
    <div className="raf-schema-form">
      <SchemaFieldRenderer
        schema={resolvedSchema}
        label={resolvedSchema.title ?? "Schema Form"}
        required={true}
        pointer=""
        value={formData}
        onChange={handleFieldChange}
        widgets={widgets}
      />
    </div>
  );
}
