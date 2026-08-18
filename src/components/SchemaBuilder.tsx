import type { ReactNode } from "react";

export interface SchemaBuilderProps {
  children?: ReactNode;
}

export function SchemaBuilder({ children }: SchemaBuilderProps) {
  return <div>{children ?? "SchemaBuilder is not implemented yet."}</div>;
}
