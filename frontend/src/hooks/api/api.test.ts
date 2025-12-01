import { renderHook, waitFor } from "@testing-library/react";
import { authenticatedFetch, apiFetch, useApiV1, FetchError } from "./api";

jest.mock("../../config");
jest.mock("../../functions/cookies");

describe("api utilities", () => {
  const mockFetch = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;

    const getRuntimeConfig = jest.requireMock("../../config").getRuntimeConfig;
    getRuntimeConfig.mockReturnValue({
      backendOrigin: "https://api.relay.firefox.com",
    });

    const getCsrfToken = jest.requireMock(
      "../../functions/cookies",
    ).getCsrfToken;
    getCsrfToken.mockReturnValue("mock-csrf-token");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("authenticatedFetch", () => {
    it("makes a fetch request with correct URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch("/test-path");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.relay.firefox.com/test-path",
        expect.any(Object),
      );
    });

    it("includes Content-Type and Accept headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch("/test");

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers;

      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Accept")).toBe("application/json");
    });

    it("includes CSRF token in headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch("/test");

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers;

      expect(headers.get("X-CSRFToken")).toBe("mock-csrf-token");
    });

    it("includes credentials in request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
        }),
      );
    });

    it("merges custom headers with default headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch("/test", {
        headers: {
          "Custom-Header": "custom-value",
        },
      });

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers;

      expect(headers.get("Custom-Header")).toBe("custom-value");
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("preserves custom Content-Type header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authenticatedFetch("/test", {
        headers: {
          "Content-Type": "text/plain",
        },
      });

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers;

      expect(headers.get("Content-Type")).toBe("text/plain");
    });

    it("returns fetch response", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ data: "test" }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await authenticatedFetch("/test");

      expect(response).toBe(mockResponse);
    });
  });

  describe("apiFetch", () => {
    it("prepends /api/v1 to route", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await apiFetch("/users/");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.relay.firefox.com/api/v1/users/",
        expect.any(Object),
      );
    });

    it("passes fetch options to authenticatedFetch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await apiFetch("/users/", {
        method: "POST",
        body: JSON.stringify({ name: "test" }),
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.method).toBe("POST");
      expect(callArgs.body).toBe(JSON.stringify({ name: "test" }));
    });
  });

  describe("FetchError", () => {
    it("creates error with response", () => {
      const mockResponse = {
        ok: false,
        status: 404,
      } as Response;

      const error = new FetchError(mockResponse);

      expect(error).toBeInstanceOf(Error);
      expect(error.response).toBe(mockResponse);
    });

    it("stores response status", () => {
      const mockResponse = {
        ok: false,
        status: 500,
      } as Response;

      const error = new FetchError(mockResponse);

      expect(error.response.status).toBe(500);
    });
  });

  describe("useApiV1", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });
    });

    it("fetches data from API route", async () => {
      const { result } = renderHook(() => useApiV1("/test-route"));

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: "test" });
      });
    });

    it("handles null route by not fetching", () => {
      renderHook(() => useApiV1(null));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws FetchError when response is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      });

      const { result } = renderHook(() => useApiV1("/not-found"));

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(FetchError);
      });
    });

    it("returns loading state initially", () => {
      const { result } = renderHook(() => useApiV1("/test"));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it("does not revalidate on focus by default", () => {
      const { result } = renderHook(() => useApiV1("/test"));

      expect(result.current.isValidating).toBeDefined();
    });

    it("accepts custom SWR options", async () => {
      const { result } = renderHook(() =>
        useApiV1("/test", {
          dedupingInterval: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: "test" });
      });

      expect(result.current.data).toEqual({ data: "test" });
    });
  });
});
