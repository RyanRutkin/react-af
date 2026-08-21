import { Component, type ReactNode, useMemo, useState } from "react";
import {
  SchemaBuilder,
  SchemaBuilderHelper,
  SchemaForm,
  type JSONSchema,
  type OutputData,
  type SchemaBuilderValidationError,
  type SchemaFormValidationError
} from "@ryanrutkin/react-af";
import { initialProfileData, peerSchemasArray, profileSchema } from "./examples/schemas";
import "./playground.css";

class FormErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : "SchemaForm failed to render."
    };
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.message) {
      this.setState({ message: null });
    }
  }

  render() {
    if (this.state.message) {
      return <div className="play-error">{this.state.message}</div>;
    }

    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState<OutputData>(initialProfileData);
  const [lastEvent, setLastEvent] = useState("No changes yet.");
  const [showcaseMode, setShowcaseMode] = useState<"form" | "builder">("form");
  const [builderSchema, setBuilderSchema] = useState<JSONSchema | null>(null);
  const [builderSidebarView, setBuilderSidebarView] = useState<"assistant" | "form" | "schema">("assistant");
  const [builderSidebarDirection, setBuilderSidebarDirection] = useState<"forward" | "backward">("forward");
  const [builderPreviewData, setBuilderPreviewData] = useState<OutputData | undefined>(undefined);
  const [builderPreviewErrors, setBuilderPreviewErrors] = useState<SchemaFormValidationError[]>([]);
  const [formValidationErrors, setFormValidationErrors] = useState<SchemaFormValidationError[]>([]);
  const [builderValidationErrors, setBuilderValidationErrors] = useState<SchemaBuilderValidationError[]>([]);
  const [schemaInput, setSchemaInput] = useState(() => JSON.stringify(profileSchema, null, 2));
  const [dataInput, setDataInput] = useState(() => JSON.stringify(initialProfileData, null, 2));

  const parsedSchema = useMemo(() => parseJson<JSONSchema>(schemaInput), [schemaInput]);
  const parsedData = useMemo(() => {
    const parsed = parseJson<OutputData>(dataInput);
    if (parsed.valid) {
      setData(parsed.value);
      return parsed;
    }
    return {
      valid: true,
      value: undefined,
      error: ""
    };
  }, [dataInput]);

  const activeData = parsedData.valid ? parsedData.value : undefined;

  const prettyData = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const setBuilderSidebarViewWithDirection = (nextView: "assistant" | "form" | "schema") => {
    if (nextView === builderSidebarView) {
      return;
    }

    const order: Record<"assistant" | "form" | "schema", number> = {
      assistant: 0,
      form: 1,
      schema: 2
    };

    setBuilderSidebarDirection(order[nextView] > order[builderSidebarView] ? "forward" : "backward");
    setBuilderSidebarView(nextView);
  };

  return (
    <div className="play-root">
      <header className="play-header">
        <h1>React AF Playground</h1>
        <p>Interactive environment for testing SchemaForm behavior and previewing SchemaBuilder export.</p>
        <div className="play-showcase-toggle" aria-label="Playground showcase mode">
          <button
            type="button"
            className={`play-toggle-button ${showcaseMode === "form" ? "play-toggle-button-active" : ""}`}
            onClick={() => setShowcaseMode("form")}
          >
            Showcase SchemaForm
          </button>
          <button
            type="button"
            className={`play-toggle-button ${showcaseMode === "builder" ? "play-toggle-button-active" : ""}`}
            onClick={() => setShowcaseMode("builder")}
          >
            Showcase SchemaBuilder
          </button>
        </div>
      </header>

      <main className="play-layout">
        {showcaseMode === "form" ? (
          <>
            <section className="play-panel">
              <h2>SchemaForm Demo</h2>
              <p className="play-note">Edit the JSON below to provide a schema and data input for the form renderer.</p>
              <div className="play-input-grid">
                <div>
                  <label className="play-input-label" htmlFor="schema-input">
                    Schema Input (JSON)
                  </label>
                  <textarea
                    id="schema-input"
                    className="play-textarea"
                    value={schemaInput}
                    onChange={(event) => setSchemaInput(event.target.value)}
                  />
                  {!parsedSchema.valid ? <div className="play-error">{parsedSchema.error}</div> : null}
                </div>

                <div>
                  <label className="play-input-label" htmlFor="data-input">
                    Data Input (JSON)
                  </label>
                  <textarea
                    id="data-input"
                    className="play-textarea"
                    value={dataInput}
                    onChange={(event) => setDataInput(event.target.value)}
                  />
                  {!parsedData.valid ? <div className="play-error">{parsedData.error}</div> : null}
                </div>
              </div>

              {parsedSchema.valid ? (
                <FormErrorBoundary>
                  <SchemaForm
                    schema={parsedSchema.value}
                    peerSchemas={peerSchemasArray}
                    data={activeData}
                    onChange={(
                      nextData: OutputData,
                      validationErrors: SchemaFormValidationError[],
                      fieldPointer: string,
                      prev: unknown,
                      next: unknown
                    ) => {
                      setFormValidationErrors(validationErrors);
                      setData(nextData);
                      setLastEvent(`Changed ${fieldPointer || "/"}: ${JSON.stringify(prev)} -> ${JSON.stringify(next)}`);
                    }}
                  />
                </FormErrorBoundary>
              ) : (
                <div className="play-error">Schema input must be valid JSON to render the form.</div>
              )}

              <ValidationErrorList title="SchemaForm Validation Errors" errors={formValidationErrors} />
            </section>

            <section className="play-panel">
              <h2>Result Data</h2>
              <div className="play-event">{lastEvent}</div>
              <pre className="play-json">{prettyData}</pre>
            </section>
          </>
        ) : (
          <>
            <section className="play-panel play-builder-main">
              <h2>SchemaBuilder</h2>
              <SchemaBuilder
                onChange={(nextSchema: JSONSchema, validationErrors: SchemaBuilderValidationError[]) => {
                  setBuilderSchema(nextSchema);
                  setBuilderValidationErrors(validationErrors);
                }}
                domain="https://ryanrutkin.github.io/react-af/playground/example/"
              />
              <ValidationErrorList title="SchemaBuilder Validation Errors" errors={builderValidationErrors} />
            </section>

            <section className="play-panel play-builder-sidebar">
              <div className="play-builder-sidebar-header">
                <div className="play-toggle-row" aria-label="SchemaBuilder side panel view">
                  <button
                    type="button"
                    className={`play-toggle-button ${builderSidebarView === "assistant" ? "play-toggle-button-active" : ""}`}
                    onClick={() => setBuilderSidebarViewWithDirection("assistant")}
                  >
                    Keyword Assistant
                  </button>
                  <button
                    type="button"
                    className={`play-toggle-button ${builderSidebarView === "form" ? "play-toggle-button-active" : ""}`}
                    onClick={() => setBuilderSidebarViewWithDirection("form")}
                  >
                    Form
                  </button>
                  <button
                    type="button"
                    className={`play-toggle-button ${builderSidebarView === "schema" ? "play-toggle-button-active" : ""}`}
                    onClick={() => setBuilderSidebarViewWithDirection("schema")}
                  >
                    Schema
                  </button>
                </div>
              </div>

              <div className={`play-builder-sidebar-panels play-builder-sidebar-panels-${builderSidebarDirection}`}>
                <section
                  className={`play-builder-sidecard play-builder-sidecard-result ${builderSidebarView === "form" ? "play-builder-sidecard-active" : "play-builder-sidecard-hidden"}`}
                  aria-hidden={builderSidebarView !== "form"}
                >
                  <h3>Form</h3>
                  <div className="play-event">Live form preview rendered from SchemaBuilder output.</div>

                  {builderSchema ? (
                    <FormErrorBoundary>
                      <SchemaForm
                        schema={builderSchema}
                        data={builderPreviewData}
                        onChange={(nextData: OutputData, validationErrors: SchemaFormValidationError[]) => {
                          setBuilderPreviewErrors(validationErrors);
                          setBuilderPreviewData(nextData);
                        }}
                      />
                    </FormErrorBoundary>
                  ) : (
                    <div className="play-error">No schema changes yet.</div>
                  )}

                  <ValidationErrorList title="Result Form Validation Errors" errors={builderPreviewErrors} />
                </section>

                <section
                  className={`play-builder-sidecard play-builder-sidecard-result ${builderSidebarView === "schema" ? "play-builder-sidecard-active" : "play-builder-sidecard-hidden"}`}
                  aria-hidden={builderSidebarView !== "schema"}
                >
                  <h3>Schema</h3>
                  <div className="play-event">Live schema emitted from SchemaBuilder onChange.</div>
                  <pre className="play-json">{builderSchema ? JSON.stringify(builderSchema, null, 2) : "No schema changes yet."}</pre>
                </section>

                <section
                  className={`play-builder-sidecard play-builder-sidecard-assistant ${builderSidebarView === "assistant" ? "play-builder-sidecard-active" : "play-builder-sidecard-hidden"}`}
                  aria-hidden={builderSidebarView !== "assistant"}
                >
                  <SchemaBuilderHelper initialQuery="condition" />
                </section>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function parseJson<T>(value: string): { valid: true; value: T } | { valid: false; error: string } {
  try {
    return { valid: true, value: JSON.parse(value) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { valid: false, error: message };
  }
}

function ValidationErrorList({ title, errors }: { title: string; errors: Array<{ message: string; source: string }> }) {
  return (
    <div className="play-validation-section">
      <h3>{title}</h3>
      {errors.length === 0 ? (
        <div className="play-validation-empty">No validation errors.</div>
      ) : (
        <ul className="play-validation-list">
          {errors.map((error, index) => (
            <li key={`${error.source}-${error.message}-${index}`}>
              <span className="play-validation-source">[{error.source}]</span> {error.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
