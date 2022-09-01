import { useEffect, useRef } from "react";

export type IntervalFunction = () => unknown | void;
/**
 * See https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 *
 * @param callback Function to execute at most every `delay` milliseconds
 * @param delay Milliseconds between calls to `callback`. `null` to disable the interval.
 */
export function useInterval(callback: IntervalFunction, delay: number | null) {
  const savedCallback = useRef<IntervalFunction | null>(null);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      if (savedCallback.current !== null) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
