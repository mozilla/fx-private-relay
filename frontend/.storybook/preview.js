import { LocalizationProvider } from "@fluent/react";
import React from "react";
import { getL10n } from "../src/functions/getL10n";
import "../src/styles/globals.scss";

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

export const decorators = [
  (Story) => (
    <LocalizationProvider l10n={getL10n()}>
      <Story />
    </LocalizationProvider>
  ),
];
