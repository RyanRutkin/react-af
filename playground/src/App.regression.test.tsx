import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("Playground regression guards", () => {
  it("keeps SchemaBuilder result Form mode stable when adding an array item", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<App />);

      const addPropertyButtons = await screen.findAllByRole("button", { name: "Add Property" });
      await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

      const propertyNameInputs = await screen.findAllByDisplayValue("field");
      const propertyNameInput = propertyNameInputs[propertyNameInputs.length - 1];
      await user.clear(propertyNameInput);
      await user.type(propertyNameInput, "numbers");

      const typeSelects = await screen.findAllByRole("combobox");
      await user.selectOptions(typeSelects[typeSelects.length - 1], "array");

      const minItemsInputs = await screen.findAllByPlaceholderText("e.g. 0");
      const minItemsInput = minItemsInputs[minItemsInputs.length - 1];
      await user.clear(minItemsInput);
      await user.type(minItemsInput, "5");

      const switchButtons = await screen.findAllByRole("button", { name: "Switch To Tuple Items" });
      await user.click(switchButtons[switchButtons.length - 1]);

      const tupleTypeSelects = await screen.findAllByRole("combobox");
      await user.selectOptions(tupleTypeSelects[tupleTypeSelects.length - 1], "number");

      const addItemButton = await screen.findByRole("button", { name: "Add Item" });
      await user.click(addItemButton);

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
