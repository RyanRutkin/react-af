import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormSelect({ label, required, schema, value, onChange }: FieldComponentProps<string>) {
  const options = Array.isArray(schema.enum) ? schema.enum : [];

  return (
    <FieldShell label={label} required={required}>
      <select className="raf-select" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {!required ? <option value="">Select...</option> : null}
        {options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
