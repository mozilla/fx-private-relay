import { ReactLocalization } from "@fluent/react";

/**
 * @param l10n A ReactLocalization instance; can be obtained using `useLocalization()`.
 * @returns The primary locale selected by the ReactLocalization instance.
 */
export function getLocale(l10n: ReactLocalization): string {
  const bundle = Array.from(l10n.bundles)[0];
  return bundle?.locales[0] ?? "en";
}
