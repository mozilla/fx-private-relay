import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

type CountryCode = string;
type LanguageCode = string;
export type PremiumCountriesData = {
  country_code: CountryCode;
  premium_countries: CountryCode[];
  premium_available_in_country: boolean;
  plan_country_lang_mapping: Record<
    CountryCode,
    Record<LanguageCode, { id: string; price: string }>
  >;
};

export const usePremiumCountries = () => {
  const premiumCountries: SWRResponse<PremiumCountriesData, unknown> =
    useApiV1("/premium_countries");
  return premiumCountries;
};
