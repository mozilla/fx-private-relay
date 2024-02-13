import { event, EventArgs } from "react-ga";
import { useGoogleAnalytics } from "./googleAnalytics";

export type { EventArgs };

function dropGaEvent(_args: EventArgs) {}

/**
 * Returns a function that sends a ping if there is no user or the user has enabled metrics.
 */
export function useGaEvent() {
  const googleAnalytics = useGoogleAnalytics();
  return googleAnalytics ? event : dropGaEvent;
}
