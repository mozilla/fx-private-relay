import { renderHook, waitFor } from "@testing-library/react";
import { useUsers } from "./user";

jest.mock("./api");

describe("useUsers", () => {
  it("fetches user data with all states and configures onErrorRetry", async () => {
    const useApiV1 = jest.requireMock("./api").useApiV1;

    useApiV1.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

    let { result, rerender } = renderHook(() => useUsers());

    const calls = useApiV1.mock.calls;
    expect(calls[0][0]).toBe("/users/");
    expect(calls[0][1]).toHaveProperty("onErrorRetry");
    expect(result.current.isLoading).toBe(true);

    const mockMutate = jest.fn();
    useApiV1.mockReturnValue({
      data: [{ email: "test@example.com" }],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });

    rerender();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
      expect(result.current.mutate).toBe(mockMutate);
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
