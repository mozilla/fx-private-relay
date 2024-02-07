import { event, EventArgs } from "react-ga";
import { useMetrics } from "./metrics";

export type { EventArgs };

/**
 * Returns a function that sends a ping if there is no user or the user has enabled metrics.
 */
export function useGaEvent() {
  const metricsEnabled = useMetrics();
  function gaEvent(args: EventArgs) {
    if (metricsEnabled) {
      event({ ...args });
    }
  }
  return gaEvent;
}
