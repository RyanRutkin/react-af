import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormInteger({ label, required, value, onChange }: FieldComponentProps<number | undefined>) {
  return (
    <FieldShell label={label} required={required}>
      <input
        className="raf-input"
        type="number"
        step={1}
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "" ? undefined : Math.trunc(Number(nextValue)));
        }}
      />
    </FieldShell>
  );
}
