/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Preview } from "@storybook/react";
import { withPerformance } from "storybook-addon-performance";
import { withTests } from "@storybook/addon-jest";
import results from "../.jest-test-results.json";
import React, { useEffect, useState } from "react";
import { getL10n } from "../src/functions/getL10n";
import { Inter } from "next/font/google";
import {
  LocalizationProvider,
  Localized,
  ReactLocalization,
} from "@fluent/react";
import { ReactAriaI18nProvider } from "../src/components/ReactAriaI18nProvider";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const withL10n = (storyFn, keys) => {
  const { parameters } = keys;
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
    document.body.classList.add(inter.className);
    document.body.classList.add(inter.variable);
  }, []);

  // We pass in the translation string name as an argument to the story
  // We use that string name here to get the translation from the Fluent bundle
  return (
    <LocalizationProvider l10n={l10n}>
      <ReactAriaI18nProvider>
        <Localized id={parameters.stringName}>{storyFn()}</Localized>
      </ReactAriaI18nProvider>
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
