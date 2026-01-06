import { renderHook, waitFor } from "@testing-library/react";
import {
  useRelayNumber,
  useRelayNumberSuggestions,
  search,
} from "./relayNumber";

jest.mock("./api", () => {
  const actual = jest.requireActual("./api");
  return {
    ...actual,
    useApiV1: jest.fn(),
    apiFetch: jest.fn(),
  };
});

const createMockRelayNumber = () => ({
  id: 1,
  number: "+15555551234",
  country_code: "US",
  enabled: true,
  remaining_texts: 100,
  remaining_minutes: 50,
  calls_forwarded: 5,
  calls_blocked: 2,
  texts_forwarded: 10,
  texts_blocked: 3,
  calls_and_texts_forwarded: 15,
  calls_and_texts_blocked: 5,
});

const createMockSuggestion = (name: string, phone: string, code: string) => ({
  friendly_name: name,
  iso_country: "US",
  locality: name,
  phone_number: phone,
  postal_code: code,
  region: "CA",
});

describe("useRelayNumber", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();
  const useApiV1 = jest.requireMock("./api").useApiV1;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock("./api").apiFetch = mockApiFetch;
  });

  const mockApiResponse = (data: any, error?: Error, isLoading = false) => {
    useApiV1.mockReturnValue({
      data,
      error,
      isLoading,
      isValidating: false,
      mutate: mockMutate,
    });
  };

  it("fetches relay number data with loading, success, and error states", async () => {
    mockApiResponse(undefined, undefined, true);
    let { result, rerender } = renderHook(() => useRelayNumber());

    expect(useApiV1).toHaveBeenCalledWith("/relaynumber/");
    expect(result.current.isLoading).toBe(true);

    mockApiResponse([createMockRelayNumber()]);
    rerender();
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    mockApiResponse(undefined, new Error("Network error"));
    rerender();
    await waitFor(() => expect(result.current.error).toBeDefined());

    mockApiResponse([]);
    renderHook(() => useRelayNumber({ disable: true }));
    expect(useApiV1).toHaveBeenCalledWith(null);
  });

  it("handles register and forwarding operations", async () => {
    mockApiResponse([]);
    const { result } = renderHook(() => useRelayNumber());

    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const registerResponse =
      await result.current.registerRelayNumber("+15555551234");
    expect(mockApiFetch).toHaveBeenCalledWith("/relaynumber/", {
      method: "POST",
      body: JSON.stringify({ number: "+15555551234" }),
    });
    expect(registerResponse.ok).toBe(true);
    expect(mockMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockMutate.mockClear();

    const setForwardingResponse = await result.current.setForwardingState(
      true,
      123,
    );
    expect(mockApiFetch).toHaveBeenCalledWith("/relaynumber/123/", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });
    expect(setForwardingResponse.ok).toBe(true);
    expect(mockMutate).toHaveBeenCalled();
  });
});

describe("useRelayNumberSuggestions", () => {
  const useApiV1 = jest.requireMock("./api").useApiV1;

  const mockApiResponse = (data: any, error?: Error, isLoading = false) => {
    useApiV1.mockReturnValue({
      data,
      error,
      isLoading,
      isValidating: false,
      mutate: jest.fn(),
    });
  };

  it("fetches relay number suggestions with all loading states", async () => {
    mockApiResponse(undefined, undefined, true);
    let { result, rerender } = renderHook(() => useRelayNumberSuggestions());

    expect(useApiV1).toHaveBeenCalledWith("/relaynumber/suggestions/");
    expect(result.current.isLoading).toBe(true);

    const mockData = {
      real_num: "+15555551234",
      same_area_options: [
        createMockSuggestion("San Francisco", "+14155551111", "94102"),
      ],
      same_prefix_options: [],
      other_areas_options: [],
      random_options: [],
    };

    mockApiResponse(mockData);
    rerender();
    await waitFor(() => expect(result.current.data).toBeDefined());

    mockApiResponse(undefined, new Error("Network error"));
    rerender();
    await waitFor(() => expect(result.current.error).toBeDefined());
  });
});

describe("search", () => {
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock("./api").apiFetch = mockApiFetch;
  });

  it("searches by area code and location, handles edge cases", async () => {
    expect(await search("")).toBeUndefined();
    expect(mockApiFetch).not.toHaveBeenCalled();

    const mockSuggestions = [
      createMockSuggestion("San Francisco", "+14155551111", "94102"),
      createMockSuggestion("Oakland", "+15105551111", "94601"),
    ];

    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuggestions,
    });

    await search("415");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/search/?area_code=415",
      { method: "GET" },
    );

    await search("San Francisco");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/search/?location=San Francisco",
      { method: "GET" },
    );

    expect(await search("California")).toEqual(mockSuggestions);

    mockApiFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(search("invalid")).rejects.toThrow(
      jest.requireActual("./api").FetchError,
    );
  });
});
