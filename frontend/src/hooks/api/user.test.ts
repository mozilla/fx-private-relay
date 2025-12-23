import { renderHook, waitFor } from "@testing-library/react";
import { useUsers } from "./user";

jest.mock("./api");

describe("useUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns user data when fetch succeeds", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    useApiV1.mockReturnValue({
      data: [{ email: "test@example.com" }],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.data).toEqual([{ email: "test@example.com" }]);
    });
  });

  it("returns error when fetch fails with non-401 error", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    const mockError = new Error("Network error");
    useApiV1.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.error).toBe(mockError);
    });
  });

  it("configures onErrorRetry handler correctly", () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;
    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

    renderHook(() => useUsers());

    const calls = useApiV1.mock.calls;
    expect(calls[0][0]).toBe("/users/");
    expect(calls[0][1]).toHaveProperty("onErrorRetry");
    expect(typeof calls[0][1].onErrorRetry).toBe("function");
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

    renderHook(() => useUsers());

    expect(useApiV1).toHaveBeenCalledWith(
      "/users/",
      expect.objectContaining({
        onErrorRetry: expect.any(Function),
      }),
    );
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

    const { result } = renderHook(() => useUsers());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("includes mutate function in response", () => {
    const mockMutate = jest.fn();
    const useApiV1 = jest.requireMock("./api").useApiV1;
    useApiV1.mockReturnValue({
      data: [{ email: "test@example.com" }],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    const { result } = renderHook(() => useUsers());

    expect(result.current.mutate).toBe(mockMutate);
  });
});
