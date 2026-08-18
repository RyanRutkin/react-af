import type { ComponentType, ReactNode } from "react";
import type { JSONSchema, OutputData, PeerSchemasInput } from "./schema";

export interface FieldComponentProps<TValue = unknown> {
  label: string;
  required: boolean;
  pointer: string;
  schema: JSONSchema;
  value: TValue;
  onChange: (next: TValue) => void;
}

export interface SchemaFormObjectProps extends FieldComponentProps<Record<string, unknown>> {
  children: ReactNode;
}

export interface SchemaFormArrayProps extends FieldComponentProps<unknown[]> {
  itemsSchema?: JSONSchema;
  renderItem: (index: number, pointer: string, value: unknown) => ReactNode;
  createDefaultItem: () => unknown;
}

export interface SchemaFormWidgets {
  String?: ComponentType<FieldComponentProps<string>>;
  Select?: ComponentType<FieldComponentProps<string>>;
  Boolean?: ComponentType<FieldComponentProps<boolean>>;
  Number?: ComponentType<FieldComponentProps<number | undefined>>;
  Integer?: ComponentType<FieldComponentProps<number | undefined>>;
  Null?: ComponentType<FieldComponentProps<null>>;
  Object?: ComponentType<SchemaFormObjectProps>;
  Array?: ComponentType<SchemaFormArrayProps>;
}

export interface SchemaFormProps {
  schema: JSONSchema;
  peerSchemas?: PeerSchemasInput;
  widgets?: SchemaFormWidgets;
  data?: OutputData;
  onChange?: (data: OutputData, fieldPointer: string, prev: any, next: any) => void;
}
