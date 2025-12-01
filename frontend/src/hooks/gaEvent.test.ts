import { renderHook } from "@testing-library/react";

// Unmock the global mock from jest.setup.ts
jest.unmock("./gaEvent");

jest.mock("react-ga", () => ({
  event: jest.fn(),
}));
jest.mock("../components/GoogleAnalyticsWorkaround", () => ({
  sendGAEvent: jest.fn(),
}));
jest.mock("./googleAnalytics");

// Import after mocking
import { useGaEvent } from "./gaEvent";
import * as ReactGA from "react-ga";
import * as GAWorkaround from "../components/GoogleAnalyticsWorkaround";

describe("useGaEvent", () => {
  const mockEvent = ReactGA.event as jest.Mock;
  const mockSendGAEvent = GAWorkaround.sendGAEvent as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a function that sends GA events when analytics is enabled", () => {
    const useGoogleAnalytics =
      jest.requireMock("./googleAnalytics").useGoogleAnalytics;
    useGoogleAnalytics.mockReturnValue(true);

    const { result } = renderHook(() => useGaEvent());

    const gaEvent = result.current;
    expect(typeof gaEvent).toBe("function");

    const eventArgs = {
      category: "Test Category",
      action: "Test Action",
      label: "Test Label",
    };

    gaEvent(eventArgs);

    expect(mockEvent).toHaveBeenCalledWith(eventArgs);
    expect(mockSendGAEvent).toHaveBeenCalledWith(
      "event",
      "Test Category-Test Action-Test Label",
      eventArgs,
    );
  });

  it("returns a function that does not send GA events when analytics is disabled", () => {
    const useGoogleAnalytics =
      jest.requireMock("./googleAnalytics").useGoogleAnalytics;
    useGoogleAnalytics.mockReturnValue(false);

    const { result } = renderHook(() => useGaEvent());

    const gaEvent = result.current;

    const eventArgs = {
      category: "Test Category",
      action: "Test Action",
      label: "Test Label",
    };

    gaEvent(eventArgs);

    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockSendGAEvent).not.toHaveBeenCalled();
  });

  it("handles events with additional properties", () => {
    const useGoogleAnalytics =
      jest.requireMock("./googleAnalytics").useGoogleAnalytics;
    useGoogleAnalytics.mockReturnValue(true);

    const { result } = renderHook(() => useGaEvent());

    const gaEvent = result.current;

    const eventArgs = {
      category: "Test Category",
      action: "Test Action",
      label: "Test Label",
      value: 42,
      nonInteraction: true,
    };

    gaEvent(eventArgs);

    expect(mockEvent).toHaveBeenCalledWith(eventArgs);
    expect(mockSendGAEvent).toHaveBeenCalledWith(
      "event",
      "Test Category-Test Action-Test Label",
      eventArgs,
    );
  });

  it("updates when analytics state changes", () => {
    const useGoogleAnalytics =
      jest.requireMock("./googleAnalytics").useGoogleAnalytics;
    useGoogleAnalytics.mockReturnValue(false);

    const { result, rerender } = renderHook(() => useGaEvent());

    let gaEvent = result.current;

    gaEvent({ category: "Test", action: "Action", label: "Label" });
    expect(mockEvent).not.toHaveBeenCalled();

    useGoogleAnalytics.mockReturnValue(true);
    rerender();

    gaEvent = result.current;
    gaEvent({ category: "Test", action: "Action", label: "Label" });
    expect(mockEvent).toHaveBeenCalledTimes(1);
  });

  it("sends both react-ga and sendGAEvent when analytics is enabled", () => {
    const useGoogleAnalytics =
      jest.requireMock("./googleAnalytics").useGoogleAnalytics;
    useGoogleAnalytics.mockReturnValue(true);

    const { result } = renderHook(() => useGaEvent());

    const eventArgs = {
      category: "Category",
      action: "Action",
      label: "Label",
    };

    result.current(eventArgs);

    expect(mockEvent).toHaveBeenCalledTimes(1);
    expect(mockSendGAEvent).toHaveBeenCalledTimes(1);
  });
});
