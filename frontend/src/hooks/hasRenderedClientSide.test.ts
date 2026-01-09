import { renderHook } from "@testing-library/react";
import { useHasRenderedClientSide } from "./hasRenderedClientSide";

describe("useHasRenderedClientSide", () => {
  it("returns true in test environment and maintains state across renders and remounts", () => {
    let { result, rerender, unmount } = renderHook(() =>
      useHasRenderedClientSide(),
    );

    expect(result.current).toBe(true);

    rerender();
    expect(result.current).toBe(true);

    unmount();

    const { result: newResult } = renderHook(() => useHasRenderedClientSide());
    expect(newResult.current).toBe(true);
  });
});
