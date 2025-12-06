import { renderHook, waitFor } from "@testing-library/react";
import { useProfiles } from "./profile";

jest.mock("./api", () => {
  const actual = jest.requireActual("./api");
  return {
    ...actual,
    apiFetch: jest.fn(),
    authenticatedFetch: jest.fn(),
  };
});

jest.mock("swr", () => {
  const actual = jest.requireActual("swr");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(),
  };
});

describe("useProfiles", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();
  const mockAuthenticatedFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutate.mockClear();
    mockApiFetch.mockClear();
    mockAuthenticatedFetch.mockClear();

    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
    api.authenticatedFetch = mockAuthenticatedFetch;
  });

  it("returns profile data when fetch succeeds", async () => {
    const useSWR = jest.requireMock("swr").default;
    const mockData = [
      {
        id: 123,
        server_storage: true,
        has_premium: true,
        has_phone: false,
        has_vpn: false,
        has_megabundle: false,
        subdomain: "test-subdomain",
        onboarding_state: 1,
        onboarding_free_state: 0,
        forwarded_first_reply: false,
        avatar: "https://example.com/avatar.jpg",
        date_subscribed: "2025-01-01T00:00:00Z",
        remove_level_one_email_trackers: true,
        next_email_try: "2025-01-02T00:00:00Z",
        bounce_status: [false, ""] as [false, ""],
        api_token: "test-token",
        emails_blocked: 10,
        emails_forwarded: 20,
        emails_replied: 5,
        level_one_trackers_blocked: 15,
        store_phone_log: true,
        metrics_enabled: true,
      },
    ];

    useSWR.mockReturnValue({
      data: mockData,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("returns error when fetch fails", async () => {
    const useSWR = jest.requireMock("swr").default;
    const mockError = new Error("Network error");

    useSWR.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    await waitFor(() => {
      expect(result.current.error).toBe(mockError);
    });
  });

  it("returns loading state while fetching", () => {
    const useSWR = jest.requireMock("swr").default;

    useSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("configures onErrorRetry handler correctly", () => {
    const useSWR = jest.requireMock("swr").default;

    useSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    renderHook(() => useProfiles());

    const calls = useSWR.mock.calls;
    expect(calls[0][0]).toBe("/profiles/");
    expect(calls[0][2]).toHaveProperty("onErrorRetry");
    expect(typeof calls[0][2].onErrorRetry).toBe("function");
  });

  it("configures revalidateOnFocus to false", () => {
    const useSWR = jest.requireMock("swr").default;

    useSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    renderHook(() => useProfiles());

    const calls = useSWR.mock.calls;
    expect(calls[0][2]).toHaveProperty("revalidateOnFocus", false);
  });

  it("includes update function in response", () => {
    const useSWR = jest.requireMock("swr").default;

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    expect(result.current.update).toBeDefined();
    expect(typeof result.current.update).toBe("function");
  });

  it("includes setSubdomain function in response", () => {
    const useSWR = jest.requireMock("swr").default;

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    expect(result.current.setSubdomain).toBeDefined();
    expect(typeof result.current.setSubdomain).toBe("function");
  });

  it("update makes PATCH request with profile data", async () => {
    const useSWR = jest.requireMock("swr").default;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    await result.current.update(123, {
      has_premium: true,
      metrics_enabled: false,
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/profiles/123/", {
      method: "PATCH",
      body: JSON.stringify({
        has_premium: true,
        metrics_enabled: false,
      }),
    });
  });

  it("update calls mutate after successful request", async () => {
    const useSWR = jest.requireMock("swr").default;
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    await result.current.update(456, { server_storage: false });

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("update returns response from API", async () => {
    const useSWR = jest.requireMock("swr").default;
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockApiFetch.mockResolvedValue(mockResponse);

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    const response = await result.current.update(789, {
      metrics_enabled: true,
    });

    expect(response).toBe(mockResponse);
  });

  it("setSubdomain makes POST request with URLSearchParams", async () => {
    const useSWR = jest.requireMock("swr").default;
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    await result.current.setSubdomain("test-subdomain");

    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      "/accounts/profile/subdomain",
      {
        method: "POST",
        body: new URLSearchParams({
          subdomain: "test-subdomain",
        }).toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
  });

  it("setSubdomain calls mutate after successful request", async () => {
    const useSWR = jest.requireMock("swr").default;
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    await result.current.setSubdomain("my-subdomain");

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("setSubdomain returns response from API", async () => {
    const useSWR = jest.requireMock("swr").default;
    const mockResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockAuthenticatedFetch.mockResolvedValue(mockResponse);

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    const response = await result.current.setSubdomain("another-subdomain");

    expect(response).toBe(mockResponse);
  });

  it("setSubdomain uses URLSearchParams format", async () => {
    const useSWR = jest.requireMock("swr").default;
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    useSWR.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useProfiles());

    await result.current.setSubdomain("test");

    const callArgs = mockAuthenticatedFetch.mock.calls[0][1];
    expect(callArgs.body).toBe("subdomain=test");
    expect(callArgs.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });
});
