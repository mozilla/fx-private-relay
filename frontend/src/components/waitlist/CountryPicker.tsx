import { SelectHTMLAttributes, useEffect, useState } from "react";
import { getLocale } from "../../functions/getLocale";
import { useL10n } from "../../hooks/l10n";

type LocaleDisplayNames = Record<string, string>;
type Territories = {
  main: Record<
    string,
    {
      localeDisplayNames: {
        territories: LocaleDisplayNames;
      };
    }
  >;
};
export type Props = SelectHTMLAttributes<HTMLSelectElement>;
export const CountryPicker = (props: Props) => {
  const l10n = useL10n();
  const currentLocale = getLocale(l10n);
  const [localeDisplayNames, setLocaleDisplayNames] =
    useState<LocaleDisplayNames>();

  useEffect(() => {
    importTerritories(currentLocale).then((localeDisplayNames) => {
      setLocaleDisplayNames(localeDisplayNames);
    });
  }, [currentLocale]);

  const options = Object.entries(localeDisplayNames ?? {})
    // cldr-localenames-modern also includes names of continents,
    // whose territory codes consist of numbers.
    // (See e.g. node_modules/cldr-localenames-modern/main/en/territories.json.)
    // Since we're only interested in countries, filter those out:
    .filter(
      ([code]) =>
        !["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].some((nr) =>
          code.includes(nr),
        ),
    )
    .sort(([_codeA, nameA], [_codeB, nameB]) => nameA.localeCompare(nameB))
    .map(([code, name]) => (
      <option key={code} value={code}>
        {name}
      </option>
    ));

  return <select {...props}>{options}</select>;
};

async function importTerritories(locale: string): Promise<LocaleDisplayNames> {
  try {
    const territories: Territories = await import(
      `cldr-localenames-modern/main/${locale}/territories.json`
    );
    return territories.main[locale].localeDisplayNames.territories;
  } catch (_e) {
    try {
      // cldr-localenames-modern doesn't include suffixed locale codes for
      // locales in their main territory (i.e. it only has `es`, not `es-ES`, or
      // `nl` but not `nl-NL`, or `sv` but not `sv-SE`), so try loading a
      // truncated version if the full version was not found:
      const truncatedLocale = locale.split("-")[0];
      const territories: Territories = await import(
        `cldr-localenames-modern/main/${truncatedLocale}/territories.json`
      );
      return territories.main[truncatedLocale].localeDisplayNames.territories;
    } catch (_e) {
      const territoriesEn = await import(
        "cldr-localenames-modern/main/en/territories.json"
      );
      return territoriesEn.main.en.localeDisplayNames.territories;
    }
  }
}
