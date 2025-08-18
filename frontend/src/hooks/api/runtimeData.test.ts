import { renderHook } from "@testing-library/react";
import { useRuntimeData } from "./runtimeData";
import { DEFAULT_RUNTIME_DATA } from "./runtimeData-default";
import type { RuntimeData } from "./types";

// Fully mock the transport; no MSW / network needed.
jest.mock("./api", () => ({
  useApiV1: jest.fn(),
}));

// Local alias to the mocked function for convenience.
const mockedUseApiV1 = jest.requireMock("./api").useApiV1 as jest.Mock;

describe("useRuntimeData (no MSW, pure unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns live API data when available", () => {
    // Distinct reference so we can assert identity.
    // @ts-expect-error minimal shape for identity assertion only
    const LIVE_DATA: RuntimeData = { __sentinel__: "live" };

    mockedUseApiV1.mockReturnValue({ data: LIVE_DATA });

    const { result } = renderHook(() => useRuntimeData());

    expect(result.current.data).toBe(LIVE_DATA);
    expect(result.current.data).not.toBe(DEFAULT_RUNTIME_DATA);
  });

  it("falls back to DEFAULT_RUNTIME_DATA when API data is undefined (client, pending/empty)", () => {
    mockedUseApiV1.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useRuntimeData());

    expect(result.current.data).toBe(DEFAULT_RUNTIME_DATA);
  });

  it("falls back to DEFAULT_RUNTIME_DATA when API errors (simulated 5xx)", () => {
    mockedUseApiV1.mockReturnValue({
      data: undefined,
      error: new Error("500 Internal Server Error"),
    });

    const { result } = renderHook(() => useRuntimeData());

    expect(result.current.data).toBe(DEFAULT_RUNTIME_DATA);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("switches from fallback to live data when API starts returning data", () => {
    let currentData: RuntimeData | undefined = undefined;
    mockedUseApiV1.mockImplementation(() => ({ data: currentData }));

    const { result, rerender } = renderHook(() => useRuntimeData());

    // initial undefined -> client fallback
    expect(result.current.data).toBe(DEFAULT_RUNTIME_DATA);

    // simulate SWR fetching success, then re-render
    // @ts-expect-error minimal shape for identity assertion only
    const LIVE_DATA: RuntimeData = { __sentinel__: "live" };
    currentData = LIVE_DATA;
    rerender();

    expect(result.current.data).toBe(LIVE_DATA);
  });
});
