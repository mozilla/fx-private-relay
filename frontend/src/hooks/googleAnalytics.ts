import ReactGa from "react-ga";
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
  ReactGa.initialize(getRuntimeConfig().googleAnalyticsId, {
    titleCase: false,
    debug: process.env.NEXT_PUBLIC_DEBUG === "true",
  });
  ReactGa.set({
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
      ReactGa.event({
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
