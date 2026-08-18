import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormString({ label, required, value, onChange }: FieldComponentProps<string>) {
  return (
    <FieldShell label={label} required={required}>
      <input
        className="raf-input"
        type="text"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}
