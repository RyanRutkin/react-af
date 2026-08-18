# react-af

React AF is a TypeScript React library for rendering forms from JSON Schema.

## Library Scripts

- `npm run build` builds the npm package output to `dist`.
- `npm run typecheck` runs TypeScript checks.
- `npm run publish:npm` publishes to npm (after `prepublishOnly` build).

Only `dist` is published, so local tooling like the playground is excluded from npm packages.

## Playground

A standalone playground app is included at `playground/` for testing and showcasing `SchemaForm` and `SchemaBuilder`.

- Install dependencies in root: `npm ci`
- Install dependencies in playground: `cd playground && npm ci`
- Run playground: `npm run playground:dev`
- Build playground: `npm run playground:build`

## GitHub Pages

GitHub Pages deployment is scaffolded in `.github/workflows/deploy-playground.yml`.

The workflow:

1. Runs on pushes to `main` (and manual dispatch)
2. Builds the playground
3. Uploads `playground/dist`
4. Deploys to GitHub Pages

To enable Pages in repository settings:

1. Go to Settings -> Pages
2. Set Source to `GitHub Actions`
