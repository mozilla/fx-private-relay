import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { useRuntimeData } from "./runtimeData";
import { DEFAULT_RUNTIME_DATA } from "./runtimeData-default";
import { initialiseServer } from "../../apiMocks/server";
import { mockedRuntimeData } from "../../apiMocks/mockData";

const server = initialiseServer();

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers(); // back to default handlers (including runtime_data success)
});

afterAll(() => {
  server.close();
});

describe("useRuntimeData (MSW-backed)", () => {
  it("uses live API runtime data when available", async () => {
    const { result } = renderHook(() => useRuntimeData());

    // Wait for the request SWR makes to resolve
    await waitFor(() => {
      expect(result.current.data).toEqual(mockedRuntimeData);
    });

    // Ensure it isn’t the fallback reference
    expect(result.current.data).not.toBe(DEFAULT_RUNTIME_DATA);
  });

  it("falls back to DEFAULT_RUNTIME_DATA when API data is unavailable", async () => {
    // Override just for this test to simulate a backend failure
    server.use(
      http.get("/api/v1/runtime_data", () =>
        HttpResponse.text(null, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useRuntimeData());

    // Immediate fallback before/after the failing fetch
    expect(result.current.data).toBe(DEFAULT_RUNTIME_DATA);
    await waitFor(() => {
      expect(result.current.data).toBe(DEFAULT_RUNTIME_DATA);
    });
  });
});
