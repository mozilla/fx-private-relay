import { useEffect, useState } from "react";
import { event as gaEvent, EventArgs } from "react-ga";
import { IntersectionOptions, useInView } from "react-intersection-observer";
import { useRuntimeData } from "./api/runtimeData";

export type FxaFlowTrackerArgs = Omit<
  EventArgs,
  "action" | "nonInteraction"
> & { entrypoint: string };

/**
 * This is similar to {@see useGaViewPing}, but this also gives you a `flowId`
 * and `flowBeginTime` that you can send to FxA to track sign-in/-up flows.
 */
export function useFxaFlowTracker(
  args: FxaFlowTrackerArgs | null,
  options?: IntersectionOptions
) {
  const runtimeData = useRuntimeData();
  const [ref, inView] = useInView({ threshold: 1, ...options });
  const [flowData, setFlowData] = useState<{
    flowId: string;
    flowBeginTime: string;
  }>();

  // If the API hasn't responded with the environment variables by the time this
  // hook fires, we assume we're dealing with the production instance of FxA:
  const fxaOrigin =
    runtimeData.data?.FXA_ORIGIN ?? "https://accounts.firefox.com";

  useEffect(() => {
    if (args === null || !inView) {
      return;
    }
    gaEvent({
      ...args,
      action: "View",
      nonInteraction: true,
    });

    // Note: there's no `.catch`; if we can't contact the metrics endpoint,
    // we accept not being able to measure this.
    fetch(
      `${fxaOrigin}/metrics-flow?form_type=other&entrypoint=${encodeURIComponent(
        args.entrypoint
      )}&utm_source=${encodeURIComponent(document.location.host)}`
    ).then(async (response) => {
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (
        typeof data.flowId !== "string" ||
        typeof data.flowBeginTime !== "string"
      ) {
        return;
      }
      setFlowData({
        flowBeginTime: data.flowBeginTime,
        flowId: data.flowId,
      });
    });

    // We don't want to trigger sending an event when `args` change;
    // only when the element does or does not come into view do we
    // send an event, with whatever the args are at that time:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return { flowData: flowData, ref: ref };
}
