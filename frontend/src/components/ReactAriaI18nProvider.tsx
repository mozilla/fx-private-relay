import { useLocalization } from "@fluent/react";
import { ReactChild } from "react";
import { I18nProvider } from "react-aria";
import { getLocale } from "../functions/getLocale";

/**
 * React-aria has some components (e.g. `<DismissButton>`) that include their
 * own strings. This component ensures that they use the same locale as the
 * rest of the application does.
 */
export const ReactAriaI18nProvider = (props: { children: ReactChild }) => {
  const { l10n } = useLocalization();
  const locale = getLocale(l10n);

  return <I18nProvider locale={locale}>{props.children}</I18nProvider>;
};
