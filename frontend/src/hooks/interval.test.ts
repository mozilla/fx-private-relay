import { renderHook } from "@testing-library/react";
import { useInterval } from "./interval";

describe("useInterval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls callback at specified interval", () => {
    const callback = jest.fn();
    renderHook(() => useInterval(callback, 1000));

    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("does not call callback when delay is null", () => {
    const callback = jest.fn();
    renderHook(() => useInterval(callback, null));

    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("stops interval when delay changes to null", () => {
    const callback = jest.fn();
    const { rerender } = renderHook(
      ({ delay }) => useInterval(callback, delay),
      { initialProps: { delay: 1000 } },
    );

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ delay: null });

    jest.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("restarts interval when delay changes from null to a number", () => {
    const callback = jest.fn();
    const { rerender } = renderHook(
      ({ delay }) => useInterval(callback, delay),
      { initialProps: { delay: null } },
    );

    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();

    rerender({ delay: 1000 });

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("uses the latest callback", () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    const { rerender } = renderHook(({ cb }) => useInterval(cb, 1000), {
      initialProps: { cb: callback1 },
    });

    jest.advanceTimersByTime(1000);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();

    rerender({ cb: callback2 });

    jest.advanceTimersByTime(1000);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("updates interval when delay changes", () => {
    const callback = jest.fn();
    const { rerender } = renderHook(
      ({ delay }) => useInterval(callback, delay),
      { initialProps: { delay: 1000 } },
    );

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ delay: 500 });

    jest.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("clears interval on unmount", () => {
    const callback = jest.fn();
    const { unmount } = renderHook(() => useInterval(callback, 1000));

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    jest.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("handles callbacks that return values", () => {
    const callback = jest.fn(() => "return value");
    renderHook(() => useInterval(callback, 1000));

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveReturnedWith("return value");
  });

  it("handles multiple intervals with different delays", () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    renderHook(() => useInterval(callback1, 1000));
    renderHook(() => useInterval(callback2, 500));

    jest.advanceTimersByTime(500);
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(500);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(2);
  });
});
