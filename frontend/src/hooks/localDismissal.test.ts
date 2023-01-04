import { act, renderHook } from "@testing-library/react";
import { mockCookiesModule } from "../../__mocks__/functions/cookies";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { useLocalDismissal } from "./localDismissal";

jest.mock("../functions/cookies.ts", () => mockCookiesModule);

setMockProfileData();

describe("useLocalDismissal", () => {
  it("marks a dismissal as dismissed if the dismissal cookie is present", () => {
    mockCookiesModule.getCookie.mockReturnValue(Date.now().toString());
    const { result } = renderHook(() => useLocalDismissal("arbitrary_key"));

    const dismissal = result.current;
    expect(dismissal.isDismissed).toBe(true);
  });

  it("re-reads the dismissal cookie when the key changes", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const { result, rerender } = renderHook(
      (key: string) => useLocalDismissal(key),
      { initialProps: "key1" }
    );

    const dismissal = result.current;
    expect(dismissal.isDismissed).toBe(false);
    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("key1_dismissed");

    mockCookiesModule.getCookie.mockReturnValue(Date.now().toString());
    rerender("key2");

    const newDismissal = result.current;
    expect(newDismissal.isDismissed).toBe(true);
    expect(mockCookiesModule.getCookie).toHaveBeenCalledWith("key2_dismissed");
  });

  it("does not mark a dismissal as dismissed if the dismissal cookie is present, but too far in the past", () => {
    // The dismissal cookie should have been set more than a second (the
    // `duration`) ago:
    mockCookiesModule.getCookie.mockReturnValue((Date.now() - 1001).toString());
    const { result } = renderHook(() =>
      useLocalDismissal("arbitrary_key", { duration: 1 })
    );

    const dismissal = result.current;
    expect(dismissal.isDismissed).toBe(false);
  });

  it("immediately marks a dismissal as dismissed by default", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const { result } = renderHook(() => useLocalDismissal("arbitrary_key"));

    act(() => {
      result.current.dismiss();
    });

    const dismissal = result.current;
    expect(dismissal.isDismissed).toBe(true);
  });

  it("sets a cookie with a default expiration time of 100 years", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const { result } = renderHook(() => useLocalDismissal("some_key"));

    act(() => {
      result.current.dismiss();
    });

    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      "some_key_dismissed",
      expect.any(String),
      { maxAgeInSeconds: 100 * 365 * 24 * 60 * 60 }
    );
  });

  it("sets the cookie's expiration time to the given value", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useLocalDismissal("some_key", { duration: 1337 })
    );

    act(() => {
      result.current.dismiss();
    });

    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      "some_key_dismissed",
      expect.any(String),
      { maxAgeInSeconds: 1337 }
    );
  });

  it("does not immediately mark a dismissal as dismissed if the `soft` option is passed", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const { result } = renderHook(() => useLocalDismissal("arbitrary_key"));

    act(() => {
      result.current.dismiss({ soft: true });
    });

    const dismissal = result.current;
    expect(dismissal.isDismissed).toBe(false);
  });

  it("sets a cookie with a default expiration time of 100 years, also for `soft` dismissals", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const { result } = renderHook(() => useLocalDismissal("some_key"));

    act(() => {
      result.current.dismiss({ soft: true });
    });

    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      "some_key_dismissed",
      expect.any(String),
      { maxAgeInSeconds: 100 * 365 * 24 * 60 * 60 }
    );
  });

  it("sets the cookie's expiration time to the given value, also for `soft` dismissals", () => {
    mockCookiesModule.getCookie.mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useLocalDismissal("some_key", { duration: 1337 })
    );

    act(() => {
      result.current.dismiss({ soft: true });
    });

    expect(mockCookiesModule.setCookie).toHaveBeenCalledWith(
      "some_key_dismissed",
      expect.any(String),
      { maxAgeInSeconds: 1337 }
    );
  });
});
