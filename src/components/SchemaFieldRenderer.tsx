import { SchemaFormArray } from "./fields/SchemaFormArray";
import { SchemaFormBoolean } from "./fields/SchemaFormBoolean";
import { SchemaFormInteger } from "./fields/SchemaFormInteger";
import { SchemaFormNull } from "./fields/SchemaFormNull";
import { SchemaFormNumber } from "./fields/SchemaFormNumber";
import { SchemaFormObject } from "./fields/SchemaFormObject";
import { SchemaFormSelect } from "./fields/SchemaFormSelect";
import { SchemaFormString } from "./fields/SchemaFormString";
import type { SchemaFormWidgets } from "../types/components";
import type { JSONSchema } from "../types/schema";
import { createDefaultValueFromSchema } from "../utils/defaultData";
import { joinPointer } from "../utils/jsonPointer";

interface SchemaFieldRendererProps {
  schema: JSONSchema;
  label: string;
  required: boolean;
  pointer: string;
  value: unknown;
  onChange: (pointer: string, next: unknown) => void;
  widgets?: SchemaFormWidgets;
}

export function SchemaFieldRenderer(props: SchemaFieldRendererProps) {
  const { schema, label, required, pointer, value, onChange, widgets } = props;
  const type = resolveType(schema);

  if (type === "object") {
    const ObjectWidget = widgets?.Object ?? SchemaFormObject;
    const objectValue = isObject(value) ? value : {};
    const requiredKeys = new Set(schema.required ?? []);
    const properties = schema.properties ?? {};

    return (
      <ObjectWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={objectValue}
        onChange={(next) => onChange(pointer, next)}
      >
        {Object.entries(properties).map(([propertyName, propertySchema]) => {
          const childPointer = joinPointer(pointer, propertyName);
          const childValue = objectValue[propertyName];

          return (
            <SchemaFieldRenderer
              key={childPointer}
              schema={propertySchema}
              label={propertySchema.title ?? propertyName}
              required={requiredKeys.has(propertyName)}
              pointer={childPointer}
              value={childValue}
              onChange={onChange}
              widgets={widgets}
            />
          );
        })}
      </ObjectWidget>
    );
  }

  if (type === "array") {
    const ArrayWidget = widgets?.Array ?? SchemaFormArray;
    const arrayValue = Array.isArray(value) ? value : [];
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;

    return (
      <ArrayWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={arrayValue}
        onChange={(next) => onChange(pointer, next)}
        itemsSchema={itemsSchema}
        createDefaultItem={() => createDefaultValueFromSchema(itemsSchema ?? {})}
        renderItem={(index, itemPointer, itemValue) => (
          <SchemaFieldRenderer
            schema={itemsSchema ?? { type: "string" }}
            label={`Item ${index + 1}`}
            required={true}
            pointer={itemPointer}
            value={itemValue}
            onChange={onChange}
            widgets={widgets}
          />
        )}
      />
    );
  }

  if (type === "boolean") {
    const BooleanWidget = widgets?.Boolean ?? SchemaFormBoolean;
    return (
      <BooleanWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={Boolean(value)}
        onChange={(next) => onChange(pointer, next)}
      />
    );
  }

  if (type === "number") {
    const NumberWidget = widgets?.Number ?? SchemaFormNumber;
    return (
      <NumberWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={typeof value === "number" ? value : undefined}
        onChange={(next) => onChange(pointer, next)}
      />
    );
  }

  if (type === "integer") {
    const IntegerWidget = widgets?.Integer ?? SchemaFormInteger;
    return (
      <IntegerWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={typeof value === "number" ? value : undefined}
        onChange={(next) => onChange(pointer, next)}
      />
    );
  }

  if (type === "null") {
    const NullWidget = widgets?.Null ?? SchemaFormNull;
    return (
      <NullWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={null}
        onChange={() => onChange(pointer, null)}
      />
    );
  }

  if (type === "string" && Array.isArray(schema.enum)) {
    const SelectWidget = widgets?.Select ?? SchemaFormSelect;
    return (
      <SelectWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={typeof value === "string" ? value : ""}
        onChange={(next) => onChange(pointer, next)}
      />
    );
  }

  const StringWidget = widgets?.String ?? SchemaFormString;
  return (
    <StringWidget
      label={label}
      required={required}
      pointer={pointer}
      schema={schema}
      value={typeof value === "string" ? value : ""}
      onChange={(next) => onChange(pointer, next)}
    />
  );
}

function resolveType(schema: JSONSchema): string {
  if (Array.isArray(schema.type) && schema.type.length > 0) {
    return schema.type[0];
  }

  if (typeof schema.type === "string") {
    return schema.type;
  }

  if (schema.properties) {
    return "object";
  }

  if (schema.items) {
    return "array";
  }

  return "string";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
