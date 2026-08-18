import type { SchemaFormObjectProps } from "../../types/components";

export function SchemaFormObject({ label, required, children }: SchemaFormObjectProps) {
  return (
    <details className="raf-object" open>
      <summary className="raf-object-summary">
        {label}
        {required ? <span className="raf-field-required">*</span> : null}
      </summary>
      <div className="raf-object-content">{children}</div>
    </details>
  );
}
