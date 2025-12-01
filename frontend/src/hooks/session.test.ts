import { renderHook } from "@testing-library/react";
import {
  getMockProfileData,
  setMockProfileData,
} from "../../__mocks__/hooks/api/profile";
import { useIsLoggedIn } from "./session";

jest.mock("./api/profile");

describe("useIsLoggedIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 'unknown' when profile data is loading", () => {
    const useProfiles = jest.requireMock("./api/profile").useProfiles;
    useProfiles.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useIsLoggedIn());

    expect(result.current).toBe("unknown");
  });

  it("returns 'logged-in' when profile data is available", () => {
    setMockProfileData();

    const { result } = renderHook(() => useIsLoggedIn());

    expect(result.current).toBe("logged-in");
  });

  it("returns 'logged-out' when profile data has an error", () => {
    const useProfiles = jest.requireMock("./api/profile").useProfiles;
    useProfiles.mockReturnValue({
      data: undefined,
      error: new Error("Failed to fetch"),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useIsLoggedIn());

    expect(result.current).toBe("logged-out");
  });

  it("returns 'logged-out' when profile data is undefined", () => {
    const useProfiles = jest.requireMock("./api/profile").useProfiles;
    useProfiles.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result } = renderHook(() => useIsLoggedIn());

    expect(result.current).toBe("logged-out");
  });

  it("updates state when profile data changes from loading to loaded", () => {
    const useProfiles = jest.requireMock("./api/profile").useProfiles;
    useProfiles.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result, rerender } = renderHook(() => useIsLoggedIn());

    expect(result.current).toBe("unknown");

    useProfiles.mockReturnValue({
      data: [getMockProfileData()],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });
    rerender();

    expect(result.current).toBe("logged-in");
  });

  it("updates state when profile data changes from loaded to error", () => {
    const useProfiles = jest.requireMock("./api/profile").useProfiles;
    useProfiles.mockReturnValue({
      data: [getMockProfileData()],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    const { result, rerender } = renderHook(() => useIsLoggedIn());

    expect(result.current).toBe("logged-in");

    useProfiles.mockReturnValue({
      data: undefined,
      error: new Error("Network error"),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });
    rerender();

    expect(result.current).toBe("logged-out");
  });
});
