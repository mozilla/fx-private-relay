import { renderHook } from "@testing-library/react";
import { useGoogleAnalytics, initGoogleAnalytics } from "./googleAnalytics";
import ReactGa from "react-ga";

// Extend the global react-ga mock to include initialize and set
const mockInitialize = jest.fn();
const mockSet = jest.fn();
const mockEvent = jest.fn();

(ReactGa as unknown as Record<string, jest.Mock>).initialize = mockInitialize;
(ReactGa as unknown as Record<string, jest.Mock>).set = mockSet;
(ReactGa as unknown as Record<string, jest.Mock>).event = mockEvent;

describe("googleAnalytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitialize.mockClear();
    mockSet.mockClear();
    mockEvent.mockClear();

    // Clear document.cookie
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  describe("useGoogleAnalytics", () => {
    it("returns false initially when GA is not initialized", () => {
      const { result } = renderHook(() => useGoogleAnalytics());
      expect(result.current).toBe(false);
    });
  });

  describe("initGoogleAnalytics", () => {
    it("initializes ReactGa with correct configuration", () => {
      initGoogleAnalytics();

      expect(mockInitialize).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          titleCase: false,
        }),
      );
    });

    it("sets anonymizeIp and transport options", () => {
      initGoogleAnalytics();

      expect(mockSet).toHaveBeenCalledWith({
        anonymizeIp: true,
        transport: "beacon",
      });
    });

    it("processes server_ga_event cookies", () => {
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "server_ga_event:test_event",
      });

      initGoogleAnalytics();

      // Just verify it doesn't throw errors when processing cookies
      expect(mockInitialize).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
    });

    it("enables debug mode when NEXT_PUBLIC_DEBUG is true", () => {
      const originalEnv = process.env.NEXT_PUBLIC_DEBUG;
      process.env.NEXT_PUBLIC_DEBUG = "true";

      initGoogleAnalytics();

      expect(mockInitialize).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          debug: true,
        }),
      );

      process.env.NEXT_PUBLIC_DEBUG = originalEnv;
    });
  });
});
