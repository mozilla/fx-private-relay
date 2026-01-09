import { renderHook } from "@testing-library/react";
import { getMockProfileData } from "../../__mocks__/hooks/api/profile";
import { useIsLoggedIn } from "./session";

jest.mock("./api/profile");

describe("useIsLoggedIn", () => {
  it("returns correct state for all scenarios and handles state transitions", () => {
    const useProfiles = jest.requireMock("./api/profile").useProfiles;

    useProfiles.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
    });
    let { result, rerender } = renderHook(() => useIsLoggedIn());
    expect(result.current).toBe("unknown");

    useProfiles.mockReturnValue({
      data: [getMockProfileData()],
      error: undefined,
      isLoading: false,
    });
    rerender();
    expect(result.current).toBe("logged-in");

    useProfiles.mockReturnValue({
      data: undefined,
      error: new Error("Network error"),
      isLoading: false,
    });
    rerender();
    expect(result.current).toBe("logged-out");

    useProfiles.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    rerender();
    expect(result.current).toBe("logged-out");
  });
});
