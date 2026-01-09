import { renderHook } from "@testing-library/react";

jest.unmock("./gaEvent");

jest.mock("react-ga", () => ({
  event: jest.fn(),
}));
jest.mock("../components/GoogleAnalyticsWorkaround", () => ({
  sendGAEvent: jest.fn(),
}));
jest.mock("./googleAnalytics");

import { useGaEvent } from "./gaEvent";
import * as ReactGA from "react-ga";
import * as GAWorkaround from "../components/GoogleAnalyticsWorkaround";

describe("useGaEvent", () => {
  const mockEvent = ReactGA.event as jest.Mock;
  const mockSendGAEvent = GAWorkaround.sendGAEvent as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends GA events when enabled, respects state changes, handles all properties", () => {
    const useGoogleAnalytics =
      jest.requireMock("./googleAnalytics").useGoogleAnalytics;

    useGoogleAnalytics.mockReturnValue(false);
    let { result, rerender } = renderHook(() => useGaEvent());

    result.current({ category: "Test", action: "Action", label: "Label" });
    expect(mockEvent).not.toHaveBeenCalled();
    expect(mockSendGAEvent).not.toHaveBeenCalled();

    useGoogleAnalytics.mockReturnValue(true);
    rerender();

    const basicEventArgs = {
      category: "Test Category",
      action: "Test Action",
      label: "Test Label",
    };

    result.current(basicEventArgs);
    expect(mockEvent).toHaveBeenCalledWith(basicEventArgs);
    expect(mockSendGAEvent).toHaveBeenCalledWith(
      "event",
      "Test Category-Test Action-Test Label",
      basicEventArgs,
    );

    mockEvent.mockClear();
    mockSendGAEvent.mockClear();

    const extendedEventArgs = {
      category: "Test Category",
      action: "Test Action",
      label: "Test Label",
      value: 42,
      nonInteraction: true,
    };

    result.current(extendedEventArgs);
    expect(mockEvent).toHaveBeenCalledWith(extendedEventArgs);
    expect(mockSendGAEvent).toHaveBeenCalledWith(
      "event",
      "Test Category-Test Action-Test Label",
      extendedEventArgs,
    );
  });
});
