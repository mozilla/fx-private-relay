import { PremiumCountriesData } from "../hooks/api/premiumCountries";

export const getPlan = (premiumCountriesData: PremiumCountriesData) => {
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
  premiumCountriesData: PremiumCountriesData
) => {
  const plan = getPlan(premiumCountriesData);

  return `${process.env.NEXT_PUBLIC_FXA_BASE_ORIGIN}subscriptions/products/${process.env.NEXT_PUBLIC_PREMIUM_PROD_ID}?plan=${plan.id}`;
};
