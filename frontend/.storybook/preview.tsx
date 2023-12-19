import type { Preview } from "@storybook/react";
import { withPerformance } from "storybook-addon-performance";
import { withTests } from "@storybook/addon-jest";
import results from "../.jest-test-results.json";
import React, { Component, useEffect, useState } from "react";
import { getL10n } from "../src/functions/getL10n";
import { Inter } from "next/font/google";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { ReactAriaI18nProvider } from "../src/components/ReactAriaI18nProvider";
import { OverlayProvider } from "@react-aria/overlays";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const withL10n = (storyFn) => {
  const [l10n, setL10n] = useState<ReactLocalization>(
    getL10n({ deterministicLocales: true }),
  );

  useEffect(() => {
    // When pre-rendering and on the first render, we deterministically load the
    // `en` bundle.  After that, however, we want to load the bundles relevant
    // to the user's preferred locales. (See the `useL10n` hook for more detail
    // on why.) Unfortunately we can't load additional needed locales
    // asynchronously on the client-side yet using @fluent/react, see
    // https://github.com/projectfluent/fluent.js/wiki/ReactLocalization/43a959b35fbf9eea694367f948cfb1387914657c#flexibility
    setL10n(getL10n({ deterministicLocales: false }));
  }, []);

  useEffect(() => {
    // We have to add these classes to the body, rather than simply wrapping the
    // storyFn in a container, because some components (most notably, the ones
    // that use useModalOverlay()) append elements to the end of the body using
    // a React Portal, thus breaking out of a container element.
    document.body.classList.add(inter.className);
    document.body.classList.add(inter.variable);
  }, []);

  return (
    <LocalizationProvider l10n={l10n}>
      <ReactAriaI18nProvider>{storyFn()}</ReactAriaI18nProvider>
    </LocalizationProvider>
  );
};

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export const decorators = [
  withL10n,
  withPerformance,
  withTests({
    results,
    filesExt: "((\\.test?))?(\\.tsx)?$",
  }),
];

export default preview;
