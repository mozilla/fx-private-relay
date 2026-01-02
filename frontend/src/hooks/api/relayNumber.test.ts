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

describe("useRelayNumber", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutate.mockClear();
    mockApiFetch.mockClear();

    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("returns relay number data when fetch succeeds", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockData = [
      {
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
      },
    ];

    useApiV1.mockReturnValue({
      data: mockData,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRelayNumber());

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

    const { result } = renderHook(() => useRelayNumber());

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

    const { result } = renderHook(() => useRelayNumber());

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

    renderHook(() => useRelayNumber());

    expect(useApiV1).toHaveBeenCalledWith("/relaynumber/");
  });

  it("passes null route when disabled option is true", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    renderHook(() => useRelayNumber({ disable: true }));

    expect(useApiV1).toHaveBeenCalledWith(null);
  });

  it("includes registerRelayNumber function in response", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useRelayNumber());

    expect(result.current.registerRelayNumber).toBeDefined();
    expect(typeof result.current.registerRelayNumber).toBe("function");
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

    const { result } = renderHook(() => useRelayNumber());

    expect(result.current.setForwardingState).toBeDefined();
    expect(typeof result.current.setForwardingState).toBe("function");
  });

  it("registerRelayNumber makes POST request with phone number", async () => {
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

    const { result } = renderHook(() => useRelayNumber());

    await result.current.registerRelayNumber("+15555551234");

    expect(mockApiFetch).toHaveBeenCalledWith("/relaynumber/", {
      method: "POST",
      body: JSON.stringify({ number: "+15555551234" }),
    });
  });

  it("registerRelayNumber calls mutate after successful request", async () => {
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

    const { result } = renderHook(() => useRelayNumber());

    await result.current.registerRelayNumber("+15555551234");

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("registerRelayNumber returns response from API", async () => {
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

    const { result } = renderHook(() => useRelayNumber());

    const response = await result.current.registerRelayNumber("+15555551234");

    expect(response).toBe(mockResponse);
  });

  it("setForwardingState makes PATCH request with enabled status", async () => {
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

    const { result } = renderHook(() => useRelayNumber());

    await result.current.setForwardingState(true, 123);

    expect(mockApiFetch).toHaveBeenCalledWith("/relaynumber/123/", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
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

    const { result } = renderHook(() => useRelayNumber());

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

    const { result } = renderHook(() => useRelayNumber());

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

    const { result } = renderHook(() => useRelayNumber());

    await result.current.setForwardingState(false, 111);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/111/",
      expect.objectContaining({
        body: JSON.stringify({ enabled: false }),
      }),
    );

    await result.current.setForwardingState(true, 222);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/222/",
      expect.objectContaining({
        body: JSON.stringify({ enabled: true }),
      }),
    );
  });
});

describe("useRelayNumberSuggestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns relay number suggestions when fetch succeeds", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockData = {
      real_num: "+15555551234",
      same_area_options: [
        {
          friendly_name: "San Francisco",
          iso_country: "US",
          locality: "San Francisco",
          phone_number: "+14155551111",
          postal_code: "94102",
          region: "CA",
        },
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

    const { result } = renderHook(() => useRelayNumberSuggestions());

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
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useRelayNumberSuggestions());

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
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useRelayNumberSuggestions());

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
      mutate: jest.fn(),
    });

    renderHook(() => useRelayNumberSuggestions());

    expect(useApiV1).toHaveBeenCalledWith("/relaynumber/suggestions/");
  });
});

describe("search", () => {
  const mockApiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
  });

  it("returns early when search string is empty", async () => {
    const result = await search("");

    expect(result).toBeUndefined();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("searches by area code when search is numeric", async () => {
    const mockSuggestions = [
      {
        friendly_name: "San Francisco",
        iso_country: "US",
        locality: "San Francisco",
        phone_number: "+14155551111",
        postal_code: "94102",
        region: "CA",
      },
    ];

    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuggestions,
    });

    await search("415");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/search/?area_code=415",
      {
        method: "GET",
      },
    );
  });

  it("searches by location when search is not numeric", async () => {
    const mockSuggestions = [
      {
        friendly_name: "San Francisco",
        iso_country: "US",
        locality: "San Francisco",
        phone_number: "+14155551111",
        postal_code: "94102",
        region: "CA",
      },
    ];

    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuggestions,
    });

    await search("San Francisco");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/search/?location=San Francisco",
      {
        method: "GET",
      },
    );
  });

  it("returns array of suggestions on success", async () => {
    const mockSuggestions = [
      {
        friendly_name: "San Francisco",
        iso_country: "US",
        locality: "San Francisco",
        phone_number: "+14155551111",
        postal_code: "94102",
        region: "CA",
      },
      {
        friendly_name: "Oakland",
        iso_country: "US",
        locality: "Oakland",
        phone_number: "+15105551111",
        postal_code: "94601",
        region: "CA",
      },
    ];

    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuggestions,
    });

    const result = await search("California");

    expect(result).toEqual(mockSuggestions);
  });

  it("throws FetchError when response is not ok", async () => {
    const FetchError = jest.requireActual("./api").FetchError;
    const mockResponse = {
      ok: false,
      status: 404,
    };

    mockApiFetch.mockResolvedValue(mockResponse);

    await expect(search("invalid")).rejects.toThrow(FetchError);
  });

  it("handles numeric strings correctly", async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await search("123");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/search/?area_code=123",
      expect.any(Object),
    );
  });

  it("handles location strings with spaces", async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await search("New York");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/relaynumber/search/?location=New York",
      expect.any(Object),
    );
  });
});
