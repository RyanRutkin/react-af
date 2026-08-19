import { render, screen, within } from "@testing-library/react";
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
});
