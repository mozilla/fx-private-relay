import ReactGa from "react-ga";
import { useState } from "react";
import { singletonHook } from "react-singleton-hook";
import { getRuntimeConfig } from "../config";

const gaIsInitialized = false;
let globalEnableGoogleAnalytics = (_: boolean): void | never => {
  throw new Error("you must useGoogleAnalytics before initializing.");
};

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
  globalEnableGoogleAnalytics(true);
}
