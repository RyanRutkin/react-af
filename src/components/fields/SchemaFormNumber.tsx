import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormNumber({ label, required, value, onChange }: FieldComponentProps<number | undefined>) {
  return (
    <FieldShell label={label} required={required}>
      <input
        className="raf-input"
        type="number"
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "" ? undefined : Number(nextValue));
        }}
      />
    </FieldShell>
  );
}
