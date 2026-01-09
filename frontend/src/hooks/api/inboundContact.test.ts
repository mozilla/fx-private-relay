import { renderHook, waitFor } from "@testing-library/react";
import { useInboundContact } from "./inboundContact";

jest.mock("./api");

const createMockContact = () => ({
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
});

describe("useInboundContact", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("fetches inbound contact data and handles setForwardingState operations", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    let { result, rerender } = renderHook(() => useInboundContact());

    expect(useApiV1).toHaveBeenCalledWith("/inboundcontact/");
    expect(result.current.isLoading).toBe(true);

    useApiV1.mockReturnValue({
      data: [createMockContact()],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    useApiV1.mockReturnValue({
      data: undefined,
      error: new Error("Network error"),
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await result.current.setForwardingState(true, 123);
    expect(mockApiFetch).toHaveBeenCalledWith("/inboundcontact/123/", {
      method: "PATCH",
      body: JSON.stringify({ blocked: true }),
    });
    expect(mockMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockMutate.mockClear();
    const mockResponse = { ok: true, json: async () => ({ success: true }) };
    mockApiFetch.mockResolvedValue(mockResponse);

    const response = await result.current.setForwardingState(false, 456);
    expect(mockApiFetch).toHaveBeenCalledWith("/inboundcontact/456/", {
      method: "PATCH",
      body: JSON.stringify({ blocked: false }),
    });
    expect(response).toBe(mockResponse);
    expect(mockMutate).toHaveBeenCalled();
  });
});
