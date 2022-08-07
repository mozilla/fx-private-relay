import { event as gaEvent, EventArgs } from "react-ga";
import { IntersectionOptions, useInView } from "react-intersection-observer";

export type GaViewPingArgs = Omit<EventArgs, "action" | "nonInteraction">;

/**
 * Returns a React RefObject, and sends a ping to Google Analytics whenever the element the Ref is attached to is scrolled into view.
 *
 * @param args Data to send to Google Analytics
 * @param options Options to configure the IntersectionObserver that influences when the ping is sent
 * @returns A React RefObject that should be attached to the element to track
 */
export function useGaViewPing(
  args: GaViewPingArgs | null,
  options?: IntersectionOptions
) {
  const { ref } = useInView({
    threshold: 1,
    ...options,
    onChange: (inView, entry) => {
      if (args === null || !inView) {
        return;
      }
      gaEvent({
        ...args,
        action: "View",
        nonInteraction: true,
      });

      if (typeof options?.onChange === "function") {
        options.onChange(inView, entry);
      }
    },
  });

  return ref;
}
