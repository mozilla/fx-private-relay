import { ReactLocalization } from "@fluent/react";
import { getLocale } from "./getLocale";
import { parseDate } from "./parseDate";

/**
 * Make sure that when we render a date, we do so consistently across the website.
 */
export const renderDate = (
  iso8601DateString: string,
  l10n: ReactLocalization
): string => {
  const formatter = new Intl.DateTimeFormat(getLocale(l10n), {
    dateStyle: "medium",
  });

  const date = parseDate(iso8601DateString);
  return formatter.format(date);
};
