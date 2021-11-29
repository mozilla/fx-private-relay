import "../styles/globals.scss";
import type { AppProps } from "next/app";
import { LocalizationProvider } from "@fluent/react";
import { SSRProvider } from "@react-aria/ssr";
import { OverlayProvider } from "@react-aria/overlays";
import { getL10n } from "../functions/getL10n";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SSRProvider>
      <LocalizationProvider l10n={getL10n()}>
        <OverlayProvider id="overlayProvider">
          <Component {...pageProps} />
        </OverlayProvider>
      </LocalizationProvider>
    </SSRProvider>
  );
}
export default MyApp;
