import { describe, it, expect } from "@jest/globals";
import { renderHook } from "@testing-library/react-hooks";
import { setMockAddonDataOnce } from "../../__mocks__/hooks/addon";
import { getMockRandomAlias } from "../../__mocks__/hooks/api/aliases";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { useLocalLabels } from "./localLabels";

setMockProfileData();
const mockedLocalStorage = {
  getItem: jest.fn<string | null, [string]>(() => null),
  setItem: jest.fn(),
};
// localStorage methods are read-only, so we use `Object.defineProperty`
// as a workaround to be able to replace them with mock functions anyway:
Object.defineProperty(window, "localStorage", { value: mockedLocalStorage });

describe("useLocalLabels", () => {
  it("is not available if the add-on is not installed", () => {
    setMockAddonDataOnce({ present: false });
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toBeNull();
  });

  it("returns labels stored in localStorage", () => {
    setMockAddonDataOnce({ present: true, localLabels: undefined });
    mockedLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify([
        { id: 0, type: "random", description: "Some description" },
      ])
    );
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toStrictEqual([
      { id: 0, type: "random", description: "Some description" },
    ]);
  });

  it("returns local labels injected by the add-on if no data was present in localStorage yet", () => {
    setMockAddonDataOnce({
      present: true,
      localLabels: [{ id: 0, type: "random", description: "Some description" }],
    });
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toStrictEqual([
      { id: 0, type: "random", description: "Some description" },
    ]);
  });

  it("does not return local labels injected by the add-on if data was present in localStorage already", () => {
    setMockAddonDataOnce({
      present: true,
      localLabels: [
        { id: 0, type: "random", description: "Arbitrary description" },
      ],
    });
    mockedLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify([
        { id: 0, type: "random", description: "Some description" },
      ])
    );
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toStrictEqual([
      { id: 0, type: "random", description: "Some description" },
    ]);
  });

  it("returns an empty array if neither the add-on nor localStorage has any labels stored", () => {
    setMockAddonDataOnce({ present: true, localLabels: undefined });
    mockedLocalStorage.getItem.mockReturnValueOnce(null);
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toStrictEqual([]);
  });

  it("replaces previous values when updating an alias label", () => {
    setMockAddonDataOnce({ present: true, localLabels: undefined });
    mockedLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify([
        { id: 0, type: "random", description: "Arbitrary description" },
      ])
    );
    const { result } = renderHook(() => useLocalLabels());
    const [_labels, updateLabel] = result.current;
    updateLabel(getMockRandomAlias({ id: 0 }), "Some description");

    expect(mockedLocalStorage.setItem).toHaveBeenLastCalledWith(
      expect.anything(),
      JSON.stringify([
        { id: 0, type: "random", description: "Some description" },
      ])
    );
  });

  it("does not affect other local labels that were modified before updating one", () => {
    setMockAddonDataOnce({ present: true, localLabels: undefined });
    // When first getting local labels, there's just the one label:
    mockedLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify([
        { id: 0, type: "random", description: "Arbitrary description" },
      ])
    );
    // Then when checking existing labels just before writing the new one,
    // a new label was added in the meantime:
    mockedLocalStorage.getItem.mockReturnValueOnce(
      JSON.stringify([
        { id: 0, type: "random", description: "Arbitrary description" },
        { id: 1, type: "random", description: "Some other description" },
      ])
    );
    const { result } = renderHook(() => useLocalLabels());
    const [_labels, updateLabel] = result.current;
    updateLabel(getMockRandomAlias({ id: 0 }), "Some description");

    expect(mockedLocalStorage.setItem).toHaveBeenLastCalledWith(
      expect.anything(),
      JSON.stringify([
        { id: 1, type: "random", description: "Some other description" },
        { id: 0, type: "random", description: "Some description" },
      ])
    );
  });
});
