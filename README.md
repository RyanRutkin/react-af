# react-af

React Autological Forms (react-af) is a React + TypeScript library for schema-driven forms.

It helps you:

- Render a working form from JSON Schema with SchemaForm.
- Build and edit JSON Schema visually with SchemaBuilder.
- Receive validation feedback on every change through each component onChange callback.

## Who This Is For

Use react-af if your project needs dynamic forms where structure, required fields, defaults, and validation rules are defined by schema instead of hand-written JSX for every form.

## Features

- JSON Schema form rendering for common types: string, number, integer, boolean, object, array, and null.
- Recursive object and array handling (nested forms out of the box).
- Default value generation from schema.
- $ref resolution with optional peer schemas.
- Validation-aware change events:
	- SchemaForm: onChange(data, validationErrors, fieldPointer, prev, next)
	- SchemaBuilder: onChange(schema, validationErrors)
- Widget overrides:
	- Override by JSON Pointer path for field-specific UI.
	- Override by schema type for reusable field components.
- Visual schema authoring with SchemaBuilder:
	- Edit title, description, type(s), enum, numeric/string constraints.
	- Manage object properties and required fields.
	- Manage array item schemas.
	- Work with allOf, anyOf, oneOf.
	- Raw JSON schema editor with parse error reporting.

## Installation

Install the package and peer dependencies in your React project.

```bash
npm install @ryanrutkin/react-af react react-dom ajv json-pointer-relational
```

Then import the components.

```tsx
import { SchemaForm, SchemaBuilder } from "@ryanrutkin/react-af";
import "@ryanrutkin/react-af/styles.css";
```

## Quick Start: SchemaForm

```tsx
import { useState } from "react";
import { SchemaForm } from "@ryanrutkin/react-af";

const schema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	type: "object",
	title: "Profile",
	properties: {
		name: { type: "string", title: "Name" },
		age: { type: "integer", title: "Age", minimum: 0 }
	},
	required: ["name"]
};

export default function App() {
	const [data, setData] = useState({});
	const [errors, setErrors] = useState([]);

	return (
		<SchemaForm
			schema={schema}
			data={data}
			onChange={(nextData, validationErrors) => {
				setData(nextData as any);
				setErrors(validationErrors);
			}}
		/>
	);
}
```

SchemaForm onChange always carries the latest validation state, including an empty array when the data is valid.

## Quick Start: SchemaBuilder

```tsx
import { useState } from "react";
import { SchemaBuilder } from "@ryanrutkin/react-af";

export default function App() {
	const [schema, setSchema] = useState({});
	const [errors, setErrors] = useState([]);

	return (
		<SchemaBuilder
			domain="https://example.com/schemas"
			onChange={(nextSchema, validationErrors) => {
				setSchema(nextSchema as any);
				setErrors(validationErrors);
			}}
		/>
	);
}
```

SchemaBuilder returns both the current schema and validation/parse errors as you edit.

## Custom Widgets

You can override rendering globally by type or precisely by schema pointer.

```tsx
<SchemaForm
	schema={schema}
	widgets={{
		String: MyStringInput,
		"/properties/name": NameInput
	}}
/>
```

Widget precedence:

1. Exact schema pointer widget
2. Type widget
3. Built-in default widget

## Peer Schemas and $ref

If your schema uses references, pass related schemas with peerSchemas.

```tsx
<SchemaForm schema={mainSchema} peerSchemas={[addressSchema, countrySchema]} />
```

## Package Scripts

- npm run build: build library output to dist.
- npm run typecheck: run TypeScript checks.
- npm run playground:dev: run the local playground app.
- npm run playground:build: build the local playground app.

## Playground and GitHub Pages

This repository includes a playground in playground for trying SchemaForm and SchemaBuilder interactively. Deployment to GitHub Pages is handled by the workflow in .github/workflows/deploy-playground.yml.
