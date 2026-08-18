import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormBoolean({ label, required, value, onChange }: FieldComponentProps<boolean>) {
  return (
    <FieldShell label={label} required={required}>
      <label className="raf-checkbox-row">
        <input
          className="raf-checkbox"
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{value ? "True" : "False"}</span>
      </label>
    </FieldShell>
  );
}
