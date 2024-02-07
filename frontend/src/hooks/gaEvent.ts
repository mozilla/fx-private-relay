import { event, EventArgs } from "react-ga";

export type { EventArgs };

export function useGaEvent() {
  function gaEvent(args: EventArgs) {
    event({ ...args });
  }
  return gaEvent;
}
