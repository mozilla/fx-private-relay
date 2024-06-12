import ReactGA from "react-ga4";
import { UaEventOptions } from "react-ga4/types/ga4";

import { useGoogleAnalytics } from "./googleAnalytics";

function dropGaEvent(_optionsOrName: UaEventOptions | string, _params?: any) {}

/**
 * Returns a function that sends a ping if there is no user or the user has enabled metrics.
 */
export function useGaEvent() {
  const googleAnalytics = useGoogleAnalytics();
  return googleAnalytics ? ReactGA.event : dropGaEvent;
}
