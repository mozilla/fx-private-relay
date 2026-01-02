import { renderHook } from "@testing-library/react";
import { mockCookiesModule } from "../../__mocks__/functions/cookies";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { useFirstSeen } from "./firstSeen";

jest.mock("../functions/cookies.ts", () => mockCookiesModule);
jest.mock("./api/profile");
jest.mock("./session");

describe("useFirstSeen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    mockCookiesModule.setCookie.mockReturnValue(undefined);

    const useIsLoggedIn = jest.requireMock("./session").useIsLoggedIn;
    useIsLoggedIn.mockReturnValue("logged-in");

    setMockProfileData({ id: 123 });
  });

  it("handles all first seen scenarios with cookie management", () => {
    const useIsLoggedIn = jest.requireMock("./session").useIsLoggedIn;

    useIsLoggedIn.mockReturnValue("logged-out");
    let { result, rerender } = renderHook(() => useFirstSeen());
    expect(result.current).toBeNull();

    useIsLoggedIn.mockReturnValue("unknown");
    rerender();
    expect(result.current).toBeNull();

    useIsLoggedIn.mockReturnValue("logged-in");
    setMockProfileData(null);
    rerender();
    expect(result.current).toBeNull();

    setMockProfileData({ id: 123 });
    const existingTimestamp = Date.now() - 86400000;
    mockCookiesModule.getCookie.mockReturnValue(existingTimestamp.toString());
    rerender();
    expect(result.current?.getTime()).toBe(existingTimestamp);
    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("first_seen_123");

    rerender();
    expect(mockCookiesModule.setCookie).not.toHaveBeenCalled();

    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const now = Date.now();
    const dateSpy = jest.spyOn(Date, "now").mockReturnValue(now);

    rerender();
    expect(result.current?.getTime()).toBe(now);
    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      "first_seen_123",
      now.toString(),
      {
        maxAgeInSeconds: 315360000,
      },
    );

    dateSpy.mockRestore();
    mockCookiesModule.getCookie.mockClear();
    mockCookiesModule.setCookie.mockClear();

    setMockProfileData({ id: 456 });
    rerender();
    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("first_seen_456");

    mockCookiesModule.getCookie.mockClear();
    setMockProfileData({ id: 789 });
    rerender();
    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("first_seen_789");
  });
});
