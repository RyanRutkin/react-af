import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormNull({ label, required }: FieldComponentProps<null>) {
  return (
    <FieldShell label={label} required={required}>
      <div className="raf-muted">Value is always null.</div>
    </FieldShell>
  );
}
