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

export type SchemaPointerWidget = ComponentType<any>;

export interface SchemaFormWidgets {
  [schemaPointer: string]: SchemaPointerWidget | undefined;
  String?: ComponentType<FieldComponentProps<string>>;
  Select?: ComponentType<FieldComponentProps<string>>;
  Boolean?: ComponentType<FieldComponentProps<boolean>>;
  Number?: ComponentType<FieldComponentProps<number | undefined>>;
  Integer?: ComponentType<FieldComponentProps<number | undefined>>;
  Null?: ComponentType<FieldComponentProps<null>>;
  Object?: ComponentType<SchemaFormObjectProps>;
  Array?: ComponentType<SchemaFormArrayProps>;
}

export interface SchemaFormOptions {
  defaults?: "all" | "required-only";
}

export interface SchemaFormProps {
  schema: JSONSchema;
  peerSchemas?: PeerSchemasInput;
  widgets?: SchemaFormWidgets;
  options?: SchemaFormOptions;
  data?: OutputData;
  onChange?: (data: OutputData, fieldPointer: string, prev: any, next: any) => void;
  onValidationError?: (errors: SchemaFormValidationError[]) => void;
}

export interface SchemaFormValidationError {
  message: string;
  source: "schema" | "peerSchemas" | "ref-resolution" | "data";
}

export interface SchemaBuilderProps {
  schema?: JSONSchema;
  domain?: string;
  onChange?: (schema: JSONSchema) => void;
  onValidationError?: (errors: SchemaBuilderValidationError[]) => void;
}

export interface SchemaBuilderValidationError {
  message: string;
  keyword?: string;
  instancePath?: string;
  schemaPath?: string;
  source: "schema" | "json-parse";
}
