import { renderHook, waitFor } from "@testing-library/react";
import { useInboundContact } from "./inboundContact";

jest.mock("./api");

describe("useInboundContact", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutate.mockClear();
    mockApiFetch.mockClear();

    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("returns inbound contact data when fetch succeeds", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockData = [
      {
        id: 1,
        relay_number: 123,
        inbound_number: "+15555551234",
        last_inbound_date: "2025-01-01",
        last_inbound_type: "call",
        num_calls: 5,
        num_calls_blocked: 2,
        last_call_date: "2025-01-01",
        num_texts: 3,
        num_texts_blocked: 1,
        last_text_date: "2025-01-02",
        blocked: false,
      },
    ];

    useApiV1.mockReturnValue({
      data: mockData,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("returns error when fetch fails", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockError = new Error("Network error");

    useApiV1.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    await waitFor(() => {
      expect(result.current.error).toBe(mockError);
    });
  });

  it("returns loading state while fetching", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("passes correct route to useApiV1", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    renderHook(() => useInboundContact());

    expect(useApiV1).toHaveBeenCalledWith("/inboundcontact/");
  });

  it("includes setForwardingState function in response", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    expect(result.current.setForwardingState).toBeDefined();
    expect(typeof result.current.setForwardingState).toBe("function");
  });

  it("setForwardingState makes PATCH request with blocked status", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    await result.current.setForwardingState(true, 123);

    expect(mockApiFetch).toHaveBeenCalledWith("/inboundcontact/123/", {
      method: "PATCH",
      body: JSON.stringify({ blocked: true }),
    });
  });

  it("setForwardingState calls mutate after successful request", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    await result.current.setForwardingState(false, 456);

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("setForwardingState returns response from API", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    const response = await result.current.setForwardingState(true, 789);

    expect(response).toBe(mockResponse);
  });

  it("setForwardingState handles enable and disable correctly", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useInboundContact());

    await result.current.setForwardingState(false, 111);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/inboundcontact/111/",
      expect.objectContaining({
        body: JSON.stringify({ blocked: false }),
      }),
    );

    await result.current.setForwardingState(true, 222);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/inboundcontact/222/",
      expect.objectContaining({
        body: JSON.stringify({ blocked: true }),
      }),
    );
  });
});
