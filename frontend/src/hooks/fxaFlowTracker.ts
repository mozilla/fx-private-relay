import { useState } from "react";
import { event as gaEvent, EventArgs } from "react-ga";
import { IntersectionOptions, useInView } from "react-intersection-observer";
import { getRuntimeConfig } from "../config";
import { useRuntimeData } from "./api/runtimeData";

export type FxaFlowTrackerArgs = Omit<
  EventArgs,
  "action" | "nonInteraction"
> & { entrypoint: string };

export type FlowData = {
  flowId: string;
  flowBeginTime: number;
};

/**
 * This is similar to {@see useGaViewPing}, but this also gives you a `flowId`
 * and `flowBeginTime` that you can send to FxA to track sign-in/-up flows.
 */
export function useFxaFlowTracker(
  args: FxaFlowTrackerArgs | null,
  options?: IntersectionOptions,
) {
  const runtimeData = useRuntimeData();
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

      fetch(
        `${fxaOrigin}/metrics-flow?form_type=other&entrypoint=${encodeURIComponent(
          args.entrypoint,
        )}&utm_source=${encodeURIComponent(document.location.host)}`,
      )
        .then(async (response) => {
          if (!response.ok) {
            return;
          }
          const data = await response.json();
          if (
            typeof data.flowId !== "string" ||
            typeof data.flowBeginTime !== "number"
          ) {
            return;
          }
          setFlowData({
            flowBeginTime: data.flowBeginTime,
            flowId: data.flowId,
          });
        })
        .catch(() => {
          // Do nothing; if we can't contact the metrics endpoint,
          // we accept not being able to measure this.
        });

      if (typeof options?.onChange === "function") {
        options.onChange(inView, entry);
      }
    },
  });
  const [flowData, setFlowData] = useState<FlowData>();

  // If the API hasn't responded with the environment variables by the time this
  // hook fires, we assume we're dealing with the production instance of FxA:
  const fxaOrigin =
    runtimeData.data?.FXA_ORIGIN ?? "https://accounts.firefox.com";

  return { flowData: flowData, ref: ref };
}

export function getLoginUrl(entrypoint: string, flowData?: FlowData): string {
  const loginUrl = getRuntimeConfig().fxaLoginUrl;
  // document is undefined when prerendering the website,
  // so just use the production URL there:
  const urlObject = new URL(
    loginUrl,
    typeof document !== "undefined"
      ? document.location.origin
      : "https://relay.firefox.com",
  );
  urlObject.searchParams.append("form_type", "button");
  urlObject.searchParams.append("entrypoint", entrypoint);
  if (flowData) {
    urlObject.searchParams.append("flowId", flowData.flowId);
    urlObject.searchParams.append(
      "flowBeginTime",
      flowData.flowBeginTime.toString(),
    );
  }

  const fullUrl = urlObject.href;
  // If the configured fxaLoginUrl was a relative URL,
  // the URL we return should be relative as well, rather than potentially
  // including the `https://relay.firefox.com` we set as the base URL so that
  // the `URL()` constructor could parse it:
  const newLoginUrl = fullUrl.substring(fullUrl.indexOf(loginUrl));
  return newLoginUrl;
}
