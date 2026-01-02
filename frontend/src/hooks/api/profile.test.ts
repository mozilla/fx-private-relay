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

const createMockProfile = () => ({
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
});

describe("useProfiles", () => {
  const mockMutate = jest.fn();
  const mockApiFetch = jest.fn();
  const mockAuthenticatedFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const api = jest.requireMock("./api");
    api.apiFetch = mockApiFetch;
    api.authenticatedFetch = mockAuthenticatedFetch;
  });

  it("fetches profile data, configures SWR, and handles update/setSubdomain operations", async () => {
    const useSWR = jest.requireMock("swr").default;

    useSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: mockMutate,
    });

    let { result, rerender } = renderHook(() => useProfiles());

    const calls = useSWR.mock.calls;
    expect(calls[0][0]).toBe("/profiles/");
    expect(calls[0][2]).toHaveProperty("onErrorRetry");
    expect(calls[0][2]).toHaveProperty("revalidateOnFocus", false);
    expect(result.current.isLoading).toBe(true);

    useSWR.mockReturnValue({
      data: [createMockProfile()],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    useSWR.mockReturnValue({
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

    useSWR.mockReturnValue({
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

    await result.current.update(123, {
      has_premium: true,
      metrics_enabled: false,
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/profiles/123/", {
      method: "PATCH",
      body: JSON.stringify({ has_premium: true, metrics_enabled: false }),
    });
    expect(mockMutate).toHaveBeenCalled();

    mockApiFetch.mockClear();
    mockMutate.mockClear();
    const mockUpdateResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockApiFetch.mockResolvedValue(mockUpdateResponse);

    const updateResponse = await result.current.update(456, {
      server_storage: false,
    });
    expect(updateResponse).toBe(mockUpdateResponse);
    expect(mockMutate).toHaveBeenCalled();

    mockMutate.mockClear();
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await result.current.setSubdomain("test-subdomain");
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      "/accounts/profile/subdomain",
      {
        method: "POST",
        body: new URLSearchParams({ subdomain: "test-subdomain" }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
    expect(mockMutate).toHaveBeenCalled();

    const callArgs = mockAuthenticatedFetch.mock.calls[0][1];
    expect(callArgs.body).toBe("subdomain=test-subdomain");

    mockAuthenticatedFetch.mockClear();
    mockMutate.mockClear();
    const mockSubdomainResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    mockAuthenticatedFetch.mockResolvedValue(mockSubdomainResponse);

    const subdomainResponse =
      await result.current.setSubdomain("another-subdomain");
    expect(subdomainResponse).toBe(mockSubdomainResponse);
    expect(mockMutate).toHaveBeenCalled();
  });
});
