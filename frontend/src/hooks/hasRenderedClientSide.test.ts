import { renderHook } from "@testing-library/react";
import { useHasRenderedClientSide } from "./hasRenderedClientSide";

describe("useHasRenderedClientSide", () => {
  it("returns true in test environment after effects run", () => {
    const { result } = renderHook(() => useHasRenderedClientSide());

    expect(result.current).toBe(true);
  });

  it("maintains true state on subsequent renders", () => {
    const { result, rerender } = renderHook(() => useHasRenderedClientSide());

    expect(result.current).toBe(true);

    rerender();
    expect(result.current).toBe(true);

    rerender();
    expect(result.current).toBe(true);
  });

  it("returns true again when hook is remounted", () => {
    const { result, unmount } = renderHook(() => useHasRenderedClientSide());

    expect(result.current).toBe(true);

    unmount();

    const { result: newResult } = renderHook(() => useHasRenderedClientSide());
    expect(newResult.current).toBe(true);
  });
});
