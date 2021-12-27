import { useEffect } from "react";
import { event as gaEvent, EventArgs } from "react-ga";
import { IntersectionOptions, useInView } from "react-intersection-observer";

export type GaPingArgs = Omit<EventArgs, "action" | "nonInteraction">;

/**
 * Returns a React RefObject, and sends a ping to Google Analytics whenever the element the Ref is attached to is scrolled into view.
 *
 * @param args Data to send to Google Analytics
 * @param options Options to configure the InstersectionObserver that influences when the ping is sent
 * @returns A React RefObject that should be attached to the element to track
 */
export function useGaPing(args: GaPingArgs, options?: IntersectionOptions) {
  const [ref, inView, entry] = useInView({ threshold: 1, ...options });

  useEffect(() => {
    if (entry?.intersectionRatio !== 1) {
      return;
    }
    gaEvent({
      ...args,
      action: "View",
      nonInteraction: true,
    });
    if (args.category === "Purchase Button") {
      document.cookie = "clicked-purchase=true; path=/; samesite=lax; secure";
    }
  }, [args, entry?.intersectionRatio, inView]);

  return ref;
}
