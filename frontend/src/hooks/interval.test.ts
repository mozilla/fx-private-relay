import { renderHook } from "@testing-library/react";
import { useInterval } from "./interval";

describe("useInterval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("handles interval lifecycle, delay changes, callback updates, and cleanup", () => {
    const callback = jest.fn();

    let { rerender, unmount } = renderHook(
      ({ cb, delay }) => useInterval(cb, delay),
      { initialProps: { cb: callback, delay: 1000 } },
    );

    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(3);

    rerender({ cb: callback, delay: null });
    jest.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(3);

    rerender({ cb: callback, delay: 500 });
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(5);

    const callback2 = jest.fn();
    rerender({ cb: callback2, delay: 1000 });
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(5);
    expect(callback2).toHaveBeenCalledTimes(1);

    unmount();
    jest.advanceTimersByTime(5000);
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});
