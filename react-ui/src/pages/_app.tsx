import "../styles/globals.scss";
import { useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import Head from "next/head";
import Favicon from "../../public/favicon.svg";
import { LocalizationProvider } from "@fluent/react";
import { SSRProvider } from "@react-aria/ssr";
import { OverlayProvider } from "@react-aria/overlays";
import ReactGa from "react-ga";
import { getL10n } from "../functions/getL10n";
import { hasDoNotTrackEnabled } from "../functions/userAgent";

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    if (hasDoNotTrackEnabled()) {
      return;
    }
    ReactGa.initialize(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID as string);
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
    // TODO: Verify that the initial page load is also tracked?
  }, []);

  useEffect(() => {
    if (hasDoNotTrackEnabled()) {
      return;
    }

    const routeChangeListener = (url: string) => {
      ReactGa.pageview(url);
    };

    router.events.on("routeChangeComplete", routeChangeListener);
    return () => {
      router.events.off("routeChangeComplete", routeChangeListener);
    };
  }, [router.events]);

  return (
    <SSRProvider>
      <LocalizationProvider l10n={getL10n()}>
        <>
          <Head>
            <link rel="icon" type="image/svg+xml" href={Favicon.src}></link>
          </Head>
          <OverlayProvider id="overlayProvider">
            <Component {...pageProps} />
          </OverlayProvider>
        </>
      </LocalizationProvider>
    </SSRProvider>
  );
}
export default MyApp;
