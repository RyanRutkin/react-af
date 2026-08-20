import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("Playground regression guards", () => {
  it("keeps SchemaBuilder result Form mode stable when adding an array item", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<App />);

      const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
      const builderSection = builderHeading.closest("section");
      expect(builderSection).not.toBeNull();
      const builder = within(builderSection as HTMLElement);

      const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
      await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

      const propertyHeading = await builder.findByText(/Property:\s*field/i);
      const propertyEditor = propertyHeading.closest("details");
      expect(propertyEditor).not.toBeNull();
      const property = within(propertyEditor as HTMLElement);

      const propertyTypeSelects = await property.findAllByRole("combobox");
      await user.selectOptions(propertyTypeSelects[0], "array");

      const minItemsInput = await property.findByRole("spinbutton", { name: "minItems" });
      await user.clear(minItemsInput);
      await user.type(minItemsInput, "5");

      const switchButton = await property.findByRole("button", { name: "Switch To Tuple Items" });
      await user.click(switchButton);

      await property.findByRole("button", { name: "Add Tuple Item Schema" });

      const tupleTypeSelects = await property.findAllByRole("combobox");
      await user.selectOptions(tupleTypeSelects[tupleTypeSelects.length - 1], "number");

      await property.findByRole("button", {
        name: /Switch To Single (Items )?Schema/i
      });

      const addTupleButtons = await property.findAllByRole("button", {
        name: "Add Tuple Item Schema"
      });
      await user.click(addTupleButtons[addTupleButtons.length - 1]);

      expect(screen.queryByText("SchemaForm failed to render.")).toBeNull();
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some(
            (entry) =>
              typeof entry === "string" &&
              entry.includes("The final argument passed to useEffect changed size between renders")
          )
        )
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("shows validation errors for const/enum type mismatch and const not in enum", async () => {
    const user = userEvent.setup();
    render(<App />);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const advancedToggle = await builder.findByText("Advanced: Edit Full Schema JSON");
    await user.click(advancedToggle);

    const invalidSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["A", "B"],
          const: "C"
        },
        age: {
          type: "number",
          enum: [1, "two"],
          const: "3"
        }
      }
    };

    const jsonEditor = (builderSection as HTMLElement).querySelector("textarea.raf-textarea:not(.raf-builder-control)");
    expect(jsonEditor).not.toBeNull();
    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(invalidSchema, null, 2) }
    });

    const constInEnumErrors = await builder.findAllByText("const value must exist in enum when both are provided.");
    expect(constInEnumErrors.length).toBeGreaterThan(0);

    const constTypeErrors = await builder.findAllByText("const value does not match the field type.");
    expect(constTypeErrors.length).toBeGreaterThan(0);

    const enumTypeErrors = await builder.findAllByText("enum value at index 1 does not match the field type.");
    expect(enumTypeErrors.length).toBeGreaterThan(0);
  });

  it("parses quoted and escaped string enum entries from comma-separated input", async () => {
    const user = userEvent.setup();
    render(<App />);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    fireEvent.change(enumInput, {
      target: { value: 'A, "B, C", \'D, E\', "F/\"G"' }
    });

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("B, C");
    expect(optionTexts).toContain("D, E");
    expect(optionTexts).toContain('F"G');
  });

  it("switches Const to select for numeric enum and clears previous const", async () => {
    const user = userEvent.setup();
    render(<App />);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "number");

    const constInput = await property.findByRole("spinbutton", { name: "Const" });
    await user.clear(constInput);
    await user.type(constInput, "5");

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    fireEvent.change(enumInput, { target: { value: "1, 2, 3" } });

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("1");
    expect(optionTexts).toContain("2");
    expect(optionTexts).toContain("3");
    expect((constSelect as HTMLSelectElement).value).toBe("");
  });

  it("supports const and enum editing for multi-type fields", async () => {
    const user = userEvent.setup();
    render(<App />);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const addTypeButton = await property.findByRole("button", { name: "Add Type" });
    await user.click(addTypeButton);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[typeSelects.length - 1], "number");

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    fireEvent.change(enumInput, { target: { value: "A, 2" } });

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("2");
    expect((constSelect as HTMLSelectElement).value).toBe("");

    await user.selectOptions(constSelect, "1");
    expect((constSelect as HTMLSelectElement).value).toBe("1");
  });

  it("allows comma after numeric token while typing multi-type enum", async () => {
    const user = userEvent.setup();
    render(<App />);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const addTypeButton = await property.findByRole("button", { name: "Add Type" });
    await user.click(addTypeButton);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[typeSelects.length - 1], "number");

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    await user.type(enumInput, "A, 1, 2");
    expect((enumInput as HTMLInputElement).value).toBe("A, 1, 2");

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("1");
    expect(optionTexts).toContain("2");
  });

  it("shows type chooser buttons for union fields and allows inserting null", async () => {
    const user = userEvent.setup();
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const unionSchema = {
      type: "object",
      properties: {
        choice: {
          type: ["string", "number", "null"]
        }
      },
      required: ["choice"]
    };

    const unionData = {
      choice: "abc"
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(unionSchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify(unionData, null, 2) }
    });

    const choiceLabel = await screen.findByText("choice");
    const choiceField = choiceLabel.closest(".raf-field");
    expect(choiceField).not.toBeNull();
    const choice = within(choiceField as HTMLElement);

    expect(await choice.findByRole("button", { name: "string" })).not.toBeNull();
    expect(await choice.findByRole("button", { name: "number" })).not.toBeNull();
    expect(await choice.findByRole("button", { name: "Insert NULL" })).not.toBeNull();

    await user.click(await choice.findByRole("button", { name: "number" }));

    const updatedChoiceField = (await screen.findByText("choice")).closest(".raf-field");
    expect(updatedChoiceField).not.toBeNull();
    const updatedChoice = within(updatedChoiceField as HTMLElement);
    expect(await updatedChoice.findByRole("spinbutton")).not.toBeNull();

    await user.click(await updatedChoice.findByRole("button", { name: "Insert NULL" }));
    expect(await screen.findByText("Value is always null.")).not.toBeNull();
  });

  it("renders union enum fields as a select without type chooser buttons", async () => {
    const user = userEvent.setup();
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const unionEnumSchema = {
      type: "object",
      properties: {
        choice: {
          type: ["string", "number"],
          enum: ["A", 1, 2]
        }
      }
    };

    const unionEnumData = {
      choice: "A"
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(unionEnumSchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify(unionEnumData, null, 2) }
    });

    const choiceLabel = await screen.findByText("choice");
    const choiceField = choiceLabel.closest(".raf-field");
    expect(choiceField).not.toBeNull();
    const choice = within(choiceField as HTMLElement);

    expect(choice.queryByRole("button", { name: "string" })).toBeNull();
    expect(choice.queryByRole("button", { name: "number" })).toBeNull();
    expect(choice.queryByRole("button", { name: "Insert NULL" })).toBeNull();

    const select = await choice.findByRole("combobox");
    const optionTexts = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("1");
    expect(optionTexts).toContain("2");

    await user.selectOptions(select, "1");

    expect(await screen.findByText(/"choice": 1/)).not.toBeNull();
  });

  it("hides the SchemaForm Add Item button when maxItems is reached", async () => {
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const arraySchema = {
      type: "object",
      properties: {
        field: {
          type: "array",
          items: {
            type: "string"
          },
          maxItems: 3
        }
      }
    };

    const arrayData = {
      field: ["one", "two", "three"]
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(arraySchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify(arrayData, null, 2) }
    });

    const fieldLabel = await screen.findByText("field");
    const field = within(fieldLabel.closest(".raf-field") as HTMLElement);

    expect(field.queryByRole("button", { name: "Add Item" })).toBeNull();
  });

  it("renders enough array children to satisfy minItems", async () => {
    render(<App />);

    const formHeading = await screen.findByRole("heading", { name: "SchemaForm Demo" });
    const formSection = formHeading.closest("section");
    expect(formSection).not.toBeNull();
    const form = within(formSection as HTMLElement);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const arraySchema = {
      type: "object",
      properties: {
        field: {
          type: "array",
          items: {
            type: "string"
          },
          minItems: 3
        }
      }
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(arraySchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify({}, null, 2) }
    });

    expect(await form.findByText("Item 1")).not.toBeNull();
    expect(await form.findByText("Item 2")).not.toBeNull();
    expect(await form.findByText("Item 3")).not.toBeNull();
  });

  it("renders prefixItems arrays as fixed positional tuple rows", async () => {
    const user = userEvent.setup();
    render(<App />);

    const formHeading = await screen.findByRole("heading", { name: "SchemaForm Demo" });
    const formSection = formHeading.closest("section");
    expect(formSection).not.toBeNull();
    const form = within(formSection as HTMLElement);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const propertyTypeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(propertyTypeSelects[0], "array");

    const switchButton = await property.findByRole("button", { name: "Switch To Tuple Items" });
    await user.click(switchButton);

    expect(await property.findByRole("button", { name: "Add Tuple Item Schema" })).not.toBeNull();

    const tupleItemEditors = await property.findAllByText(/Tuple Item \d+/i);
    expect(tupleItemEditors.length).toBeGreaterThanOrEqual(1);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    fireEvent.change(schemaInput, {
      target: {
        value: JSON.stringify(
          {
            type: "object",
            properties: {
              field: {
                type: ["array"],
                prefixItems: [
                  { title: "First Tuple", type: "string" },
                  { type: "number" }
                ],
                items: false,
                minItems: 2
              }
            }
          },
          null,
          2
        )
      }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify({ field: ["one", 2] }, null, 2) } }
    );

    const fieldLabel = await form.findByText("field");
    const field = within(fieldLabel.closest(".raf-field") as HTMLElement);

    expect(await field.findByText("First Tuple")).not.toBeNull();
    expect(await field.findByText("Tuple 2")).not.toBeNull();
    expect(field.queryByRole("button", { name: "Add Item" })).toBeNull();
    expect(field.queryByRole("button", { name: "Remove" })).toBeNull();
  });
});
