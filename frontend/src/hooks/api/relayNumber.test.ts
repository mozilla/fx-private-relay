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

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("fetches relay number data and handles register/forwarding operations", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    let { result, rerender } = renderHook(() => useRelayNumber());

    expect(useApiV1).toHaveBeenCalledWith("/relaynumber/");
    expect(result.current.isLoading).toBe(true);

    useApiV1.mockReturnValue({
      data: [createMockRelayNumber()],
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
    renderHook(() => useRelayNumber({ disable: true }));
    expect(useApiV1).toHaveBeenCalledWith(null);

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
  it("fetches relay number suggestions with all loading states", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

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

    useApiV1.mockReturnValue({
      data: mockData,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    rerender();
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    useApiV1.mockReturnValue({
      data: undefined,
      error: new Error("Network error"),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    rerender();
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});

describe("search", () => {
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("searches by area code and location, handles edge cases", async () => {
    const result = await search("");
    expect(result).toBeUndefined();
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

    const searchResult = await search("California");
    expect(searchResult).toEqual(mockSuggestions);

    const FetchError = jest.requireActual("./api").FetchError;
    mockApiFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(search("invalid")).rejects.toThrow(FetchError);
  });
});
