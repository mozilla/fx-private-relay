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

  it("returns null when user is not logged in", () => {
    const useIsLoggedIn = jest.requireMock("./session").useIsLoggedIn;
    useIsLoggedIn.mockReturnValue("logged-out");

    const { result } = renderHook(() => useFirstSeen());

    expect(result.current).toBeNull();
  });

  it("returns null when user login state is unknown", () => {
    const useIsLoggedIn = jest.requireMock("./session").useIsLoggedIn;
    useIsLoggedIn.mockReturnValue("unknown");

    const { result } = renderHook(() => useFirstSeen());

    expect(result.current).toBeNull();
  });

  it("returns null when profile data is unavailable", () => {
    setMockProfileData(null);

    const { result } = renderHook(() => useFirstSeen());

    expect(result.current).toBeNull();
  });

  it("returns existing first seen date when cookie exists", () => {
    const timestamp = Date.now() - 86400000; // 1 day ago
    mockCookiesModule.getCookie.mockReturnValue(timestamp.toString());

    const { result } = renderHook(() => useFirstSeen());

    expect(result.current).toBeInstanceOf(Date);
    expect(result.current?.getTime()).toBe(timestamp);
    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("first_seen_123");
  });

  it("creates and returns new first seen date when cookie does not exist", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);

    mockCookiesModule.getCookie.mockReturnValue(undefined);

    const { result } = renderHook(() => useFirstSeen());

    expect(result.current).toBeInstanceOf(Date);
    expect(result.current?.getTime()).toBe(now);
    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      "first_seen_123",
      now.toString(),
      {
        maxAgeInSeconds: 10 * 365 * 24 * 60 * 60,
      },
    );

    jest.restoreAllMocks();
  });

  it("uses profile id in cookie key", () => {
    setMockProfileData({ id: 456 });
    mockCookiesModule.getCookie.mockReturnValue(undefined);

    renderHook(() => useFirstSeen());

    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("first_seen_456");
    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      "first_seen_456",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("returns same date on subsequent calls when cookie exists", () => {
    const timestamp = Date.now() - 3600000; // 1 hour ago
    mockCookiesModule.getCookie.mockReturnValue(timestamp.toString());

    const { result, rerender } = renderHook(() => useFirstSeen());

    const firstDate = result.current;
    expect(firstDate?.getTime()).toBe(timestamp);

    rerender();

    const secondDate = result.current;
    expect(secondDate?.getTime()).toBe(timestamp);
    expect(mockCookiesModule.setCookie).not.toHaveBeenCalled();
  });

  it("handles cookie value parsing correctly", () => {
    const timestamp = 1234567890000;
    mockCookiesModule.getCookie.mockReturnValue(timestamp.toString());

    const { result } = renderHook(() => useFirstSeen());

    expect(result.current?.getTime()).toBe(timestamp);
  });

  it("sets cookie with 10 year expiry", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);

    renderHook(() => useFirstSeen());

    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      {
        maxAgeInSeconds: 315360000, // 10 * 365 * 24 * 60 * 60
      },
    );

    jest.restoreAllMocks();
  });

  it("updates when profile id changes", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);

    const { rerender } = renderHook(() => useFirstSeen());

    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("first_seen_123");

    setMockProfileData({ id: 789 });
    rerender();

    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("first_seen_789");
  });
});
