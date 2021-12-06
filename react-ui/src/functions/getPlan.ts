import { PremiumCountriesData } from "../hooks/api/premiumCountries";

export const getPlan = (
  premiumCountriesData: PremiumCountriesDataWithPremiumAvailable
) => {
  const languageCode = navigator.language.split("-")[0].toLowerCase();
  const countryPlans =
    premiumCountriesData.plan_country_lang_mapping[
      premiumCountriesData.country_code
    ];
  const plan =
    countryPlans[languageCode] ?? countryPlans[Object.keys(countryPlans)[0]];

  return plan;
};

export const getPremiumSubscribeLink = (
  premiumCountriesData: PremiumCountriesDataWithPremiumAvailable
) => {
  const plan = getPlan(premiumCountriesData);

  return `${process.env.NEXT_PUBLIC_FXA_BASE_ORIGIN}subscriptions/products/${process.env.NEXT_PUBLIC_PREMIUM_PROD_ID}?plan=${plan.id}`;
};

/**
 * This type ensures that [[getPlan]] and [[getPremiumSubscribeLink]] are not called
 * unless we can count on a plan being available for them to return
 * (i.e. after that's been checked with our user-defined type guard
 * [isPremiumAvailableInCountry]).
 */
export type PremiumCountriesDataWithPremiumAvailable = PremiumCountriesData & {
  premium_available_in_country: true;
};

export function isPremiumAvailableInCountry(
  premiumCountriesData: PremiumCountriesData | undefined
): premiumCountriesData is PremiumCountriesDataWithPremiumAvailable {
  return premiumCountriesData?.premium_available_in_country === true;
}
