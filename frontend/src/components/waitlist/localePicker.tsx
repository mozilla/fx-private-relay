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
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
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
    const languagesEn = await import(
      "cldr-localenames-modern/main/en/languages.json"
    );
    return languagesEn.main.en.localeDisplayNames.languages;
  }
}
