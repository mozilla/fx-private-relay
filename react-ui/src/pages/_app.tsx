import "../styles/globals.css";
import type { AppProps } from "next/app";
import { LocalizationProvider } from "@fluent/react";
import { SSRProvider } from "@react-aria/ssr";
import { getL10n } from "../functions/getL10n";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SSRProvider>
      <LocalizationProvider l10n={getL10n()}>
        <Component {...pageProps} />
      </LocalizationProvider>
    </SSRProvider>
  );
}
export default MyApp;
