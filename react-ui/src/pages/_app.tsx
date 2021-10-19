import "../styles/globals.css";
import type { AppProps } from "next/app";
import { LocalizationProvider } from "@fluent/react";
import { getL10n } from "../functions/getL10n";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <LocalizationProvider l10n={getL10n()}>
      <Component {...pageProps} />
    </LocalizationProvider>
  );
}
export default MyApp;
