import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const playgroundNodeModules = path.resolve(__dirname, "node_modules");

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@ryanrutkin/react-af": path.resolve(__dirname, "../src/index.ts"),
      react: path.resolve(playgroundNodeModules, "react"),
      "react-dom": path.resolve(playgroundNodeModules, "react-dom"),
      "react/jsx-runtime": path.resolve(playgroundNodeModules, "react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(playgroundNodeModules, "react/jsx-dev-runtime.js"),
      ajv: path.resolve(playgroundNodeModules, "ajv"),
      "ajv/dist/2019": path.resolve(playgroundNodeModules, "ajv/dist/2019.js"),
      "ajv/dist/2020": path.resolve(playgroundNodeModules, "ajv/dist/2020.js"),
      "json-pointer-relational": path.resolve(playgroundNodeModules, "json-pointer-relational")
    }
  }
});
