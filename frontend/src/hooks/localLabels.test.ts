import { describe, it, expect } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-hooks";
import { setMockAddonDataOnce } from "../../__mocks__/hooks/addon";
import { getMockRandomAlias } from "../../__mocks__/hooks/api/aliases";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { useLocalLabels } from "./localLabels";

setMockProfileData();

describe("useLocalLabels", () => {
  it("is not available if the add-on is not installed", () => {
    setMockAddonDataOnce({ present: false });
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toBeNull();
  });

  it("returns local labels injected by the add-on", () => {
    setMockAddonDataOnce({
      present: true,
      localLabels: [
        {
          id: 0,
          type: "random",
          description: "Some description",
          generated_for: "https://example.com",
        },
      ],
    });
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toStrictEqual([
      {
        id: 0,
        type: "random",
        description: "Some description",
        generated_for: "https://example.com",
      },
    ]);
  });

  it("returns an empty array if the add-on does not have any labels stored", () => {
    setMockAddonDataOnce({ present: true, localLabels: undefined });
    const { result } = renderHook(() => useLocalLabels());

    const [labels] = result.current;

    expect(labels).toStrictEqual([]);
  });

  it("replaces previous values when updating an alias label", () => {
    setMockAddonDataOnce({
      present: true,
      localLabels: [
        {
          id: 0,
          type: "random",
          description: "Some description",
          generated_for: "https://example.com",
        },
      ],
    });
    setMockAddonDataOnce({
      present: true,
      localLabels: [
        {
          id: 0,
          type: "random",
          description: "Some description",
          generated_for: "https://example.com",
        },
      ],
    });
    const { result } = renderHook(() => useLocalLabels());
    const [_labels, updateLabel] = result.current;

    act(() => {
      updateLabel(getMockRandomAlias({ id: 0 }), "Some new description");
    });

    const [newLabels] = result.current;
    expect(newLabels).toStrictEqual([
      {
        id: 0,
        type: "random",
        description: "Some new description",
        generated_for: "https://example.com",
      },
    ]);
  });
});
