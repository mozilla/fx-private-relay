import { event, EventArgs } from "react-ga";

import { sendGAEvent } from "../components/GoogleAnalyticsWorkaround";

import { useGoogleAnalytics } from "./googleAnalytics";

export type { EventArgs };

function dropGaEvent(_args: EventArgs) {}

function doubleGaEvent(args: EventArgs) {
  event(args);
  sendGAEvent("event", `${args.category}-${args.action}-${args.label}`, args);
}
/**
 * Returns a function that sends a ping if there is no user or the user has enabled metrics.
 */
export function useGaEvent() {
  const googleAnalytics = useGoogleAnalytics();
  return googleAnalytics ? doubleGaEvent : dropGaEvent;
}
