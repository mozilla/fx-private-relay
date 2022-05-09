import { useLocalization } from "@fluent/react";
import { SelectHTMLAttributes, useEffect, useState } from "react";
import { getLocale } from "../../functions/getLocale";

type LocaleDisplayNames = Record<string, string>;
type Languages = {
  main: Record<
    string,
    {
      localeDisplayNames: {
        languages: LocaleDisplayNames;
      };
    }
  >;
};
export type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  supportedLocales: string[];
};
export const LocalePicker = ({ supportedLocales, ...selectProps }: Props) => {
  const { l10n } = useLocalization();
  const currentLocale = getLocale(l10n);
  const [localeDisplayNames, setLocaleDisplayNames] =
    useState<LocaleDisplayNames>();

  useEffect(() => {
    importLanguages(currentLocale).then((localeDisplayNames) => {
      setLocaleDisplayNames(localeDisplayNames);
    });
  }, [currentLocale]);

  const options = Object.entries(localeDisplayNames ?? {})
    .sort(([_codeA, nameA], [_codeB, nameB]) => nameA.localeCompare(nameB))
    .filter(([code]) => supportedLocales.includes(code))
    .map(([code, name]) => (
      <option key={code} value={code}>
        {name}
      </option>
    ));

  return <select {...selectProps}>{options}</select>;
};

async function importLanguages(locale: string): Promise<LocaleDisplayNames> {
  try {
    const languages: Languages = await import(
      `cldr-localenames-modern/main/${locale}/languages.json`
    );
    return languages.main[locale].localeDisplayNames.languages;
  } catch (_e) {
    try {
      // cldr-localenames-modern doesn't include suffixed locale codes for
      // locales in their main territory (i.e. it only has `es`, not `es-ES`, or
      // `nl` but not `nl-NL`, or `sv` but not `sv-SE`), so try loading a
      // truncated version if the full version was not found:
      const truncatedLocale = locale.split("-")[0];
      const languages: Languages = await import(
        `cldr-localenames-modern/main/${truncatedLocale}/languages.json`
      );
      return languages.main[truncatedLocale].localeDisplayNames.languages;
    } catch (_e) {
      const languagesEn = await import(
        "cldr-localenames-modern/main/en/languages.json"
      );
      return languagesEn.main.en.localeDisplayNames.languages;
    }
  }
}
