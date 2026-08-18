import type { SchemaFormArrayProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormArray({
  label,
  required,
  pointer,
  value,
  onChange,
  renderItem,
  createDefaultItem
}: SchemaFormArrayProps) {
  const items = Array.isArray(value) ? value : [];

  return (
    <FieldShell label={label} required={required}>
      <div>
        {items.map((item, index) => {
          const itemPointer = `${pointer}/${index}`;

          return (
            <div className="raf-array-item" key={itemPointer}>
              {renderItem(index, itemPointer, item)}
              <div className="raf-button-row">
                <button
                  className="raf-button raf-button-danger"
                  type="button"
                  onClick={() => {
                    const next = [...items];
                    next.splice(index, 1);
                    onChange(next);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button
          className="raf-button raf-button-primary"
          type="button"
          onClick={() => {
            const next = [...items, createDefaultItem()];
            onChange(next);
          }}
        >
          Add Item
        </button>
      </div>
    </FieldShell>
  );
}
