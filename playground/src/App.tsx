import { Component, type ReactNode, useMemo, useState } from "react";
import { SchemaBuilder, SchemaForm, type JSONSchema, type OutputData } from "react-af";
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
  const [schemaInput, setSchemaInput] = useState(() => JSON.stringify(profileSchema, null, 2));
  const [dataInput, setDataInput] = useState(() => JSON.stringify(initialProfileData, null, 2));

  const parsedSchema = useMemo(() => parseJson<JSONSchema>(schemaInput), [schemaInput]);
  const parsedData = useMemo(() => {
    const parsed = parseJson<OutputData>(dataInput);
    if (parsed.valid) {
        setData(parsed.value);
        return parsed.value;
    }
    return undefined;
  }, [dataInput]);

  const prettyData = useMemo(() => JSON.stringify(data, null, 2), [data]);

  return (
    <div className="play-root">
      <header className="play-header">
        <h1>React AF Playground</h1>
        <p>Interactive environment for testing SchemaForm behavior and previewing SchemaBuilder export.</p>
      </header>

      <main className="play-layout">
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
              {
                parsedData && (
                    <>
                        {!parsedData.valid ? <div className="play-error">{parsedData.error}</div> : null}
                    </>
                )
              }
            </div>
          </div>

          {parsedSchema.valid ? (
            <FormErrorBoundary>
              <SchemaForm
                schema={parsedSchema.value}
                peerSchemas={peerSchemasArray}
                data={parsedData}
                onChange={(nextData, fieldPointer, prev, next) => {
                  setData(nextData);
                  setDataInput(JSON.stringify(nextData, null, 2));
                  setLastEvent(`Changed ${fieldPointer || "/"}: ${JSON.stringify(prev)} -> ${JSON.stringify(next)}`);
                }}
              />
            </FormErrorBoundary>
          ) : (
            <div className="play-error">Schema input must be valid JSON to render the form.</div>
          )}
        </section>

        <section className="play-panel">
          <h2>Result Data</h2>
          <div className="play-event">{lastEvent}</div>
          <pre className="play-json">{prettyData}</pre>
        </section>

        <section className="play-panel">
          <h2>SchemaBuilder Placeholder</h2>
          <SchemaBuilder />
          <p className="play-note">SchemaBuilder details are pending and can be added in the next prompt.</p>
        </section>
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
