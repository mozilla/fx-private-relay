import "../styles/globals.scss";
import { useEffect, useRef } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { LocalizationProvider } from "@fluent/react";
import { SSRProvider } from "@react-aria/ssr";
import { OverlayProvider } from "@react-aria/overlays";
import ReactGa from "react-ga";
import { getL10n } from "../functions/getL10n";
import { hasDoNotTrackEnabled } from "../functions/userAgent";
import { AddonDataContext, useAddonElementWatcher } from "../hooks/addon";
import { getRuntimeConfig } from "../config";
import { ReactAriaI18nProvider } from "../components/ReactAriaI18nProvider";

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const addonDataElementRef = useRef<HTMLElement>(null);

  const addonData = useAddonElementWatcher(addonDataElementRef);

  useEffect(() => {
    if (hasDoNotTrackEnabled()) {
      return;
    }
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
      item.trim().startsWith("server_ga_event:")
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
  }, []);

  useEffect(() => {
    if (hasDoNotTrackEnabled()) {
      return;
    }
    ReactGa.pageview(router.asPath);
  }, [router.asPath]);

  return (
    <SSRProvider>
      <LocalizationProvider l10n={getL10n()}>
        <ReactAriaI18nProvider>
          <AddonDataContext.Provider value={addonData}>
            <firefox-private-relay-addon
              ref={addonDataElementRef}
              data-addon-installed={addonData.present}
              data-user-logged-in={addonData.isLoggedIn}
              data-local-labels={JSON.stringify(addonData.localLabels)}
            ></firefox-private-relay-addon>
            <OverlayProvider id="overlayProvider">
              <Component {...pageProps} />
            </OverlayProvider>
          </AddonDataContext.Provider>
        </ReactAriaI18nProvider>
      </LocalizationProvider>
    </SSRProvider>
  );
}
export default MyApp;
