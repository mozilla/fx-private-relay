import ReactGA from "react-ga4";
import { useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { getRuntimeConfig } from "../config";

let gaIsInitialized = false;
let globalEnableGoogleAnalytics: null | ((_: boolean) => void) = null;

export const useGoogleAnalytics = singletonHook(gaIsInitialized, () => {
  const [isInitialized, setIsInitialized] = useState(gaIsInitialized);
  globalEnableGoogleAnalytics = setIsInitialized;
  return isInitialized;
});

export function initGoogleAnalytics() {
  ReactGA.initialize([
    {
      trackingId: getRuntimeConfig().googleAnalyticsId,
      gaOptions: {
        title_case: false,
        debug_mode: process.env.NEXT_PUBLIC_DEBUG === "true",
      },
      gtagOptions: {
        title_case: false,
        debug_mode: process.env.NEXT_PUBLIC_DEBUG === "true",
      },
    },
  ]);
  ReactGA.set({
    anonymizeIp: true,
    transport: "beacon",
  });
  const cookies = document.cookie.split("; ");
  const gaEventCookies = cookies.filter((item) =>
    item.trim().startsWith("server_ga_event:"),
  );
  gaEventCookies.forEach((item) => {
    const serverEventLabel = item.split("=")[1];
    if (serverEventLabel) {
      ReactGA.event({
        category: "server event",
        action: "fired",
        label: serverEventLabel,
      });
    }
  });
  if (globalEnableGoogleAnalytics === null) {
    // useGoogleAnalytics is not complete. Set initial value.
    gaIsInitialized = true;
  } else {
    // Notify listeners that Google Analytics is available.
    globalEnableGoogleAnalytics(true);
  }
}
