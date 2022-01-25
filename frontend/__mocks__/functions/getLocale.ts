import { ReactLocalization } from "@fluent/react";

export const mockGetLocaleModule = {
  getLocale: jest.fn((_l10n: ReactLocalization) => "en-GB"),
};
