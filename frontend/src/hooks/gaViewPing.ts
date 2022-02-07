import { useEffect } from "react";
import { event as gaEvent, EventArgs } from "react-ga";
import { IntersectionOptions, useInView } from "react-intersection-observer";

export type GaViewPingArgs = Omit<EventArgs, "action" | "nonInteraction">;

/**
 * Returns a React RefObject, and sends a ping to Google Analytics whenever the element the Ref is attached to is scrolled into view.
 *
 * @param args Data to send to Google Analytics
 * @param options Options to configure the InstersectionObserver that influences when the ping is sent
 * @returns A React RefObject that should be attached to the element to track
 */
export function useGaViewPing(
  args: GaViewPingArgs | null,
  options?: IntersectionOptions
) {
  const [ref, inView] = useInView({ threshold: 1, ...options });

  useEffect(() => {
    if (args === null || !inView) {
      return;
    }
    gaEvent({
      ...args,
      action: "View",
      nonInteraction: true,
    });
    // We don't want to trigger sending an event when `args` change;
    // only when the element does or does not come into view do we
    // send an event, with whatever the args are at that time:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return ref;
}
