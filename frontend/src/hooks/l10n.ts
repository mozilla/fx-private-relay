import { ReactLocalization, useLocalization } from "@fluent/react";

export const useL10n = (): ReactLocalization => {
  const { l10n } = useLocalization();

  return l10n;
};
