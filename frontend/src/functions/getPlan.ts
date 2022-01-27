import { RuntimeData } from "../hooks/api/runtimeData";

export const getPlan = (runtimeData: RuntimeDataWithPremiumAvailable) => {
  const languageCode = navigator.language.split("-")[0].toLowerCase();
  const countryPlans =
    runtimeData.PREMIUM_PLANS.plan_country_lang_mapping[
      runtimeData.PREMIUM_PLANS.country_code
    ];
  const plan =
    countryPlans[languageCode] ?? countryPlans[Object.keys(countryPlans)[0]];

  return plan;
};

export const getPremiumSubscribeLink = (
  runtimeData: RuntimeDataWithPremiumAvailable
) => {
  const plan = getPlan(runtimeData);

  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PREMIUM_PRODUCT_ID}?plan=${plan.id}`;
};

/**
 * This type ensures that [[getPlan]] and [[getPremiumSubscribeLink]] are not called
 * unless we can count on a plan being available for them to return
 * (i.e. after that's been checked with our user-defined type guard
 * [isPremiumAvailableInCountry]).
 */
export type RuntimeDataWithPremiumAvailable = RuntimeData & {
  PREMIUM_PLANS: RuntimeData["PREMIUM_PLANS"] & {
    premium_available_in_country: true;
  };
};

export function isPremiumAvailableInCountry(
  runtimeData: RuntimeData | undefined
): runtimeData is RuntimeDataWithPremiumAvailable {
  return runtimeData?.PREMIUM_PLANS?.premium_available_in_country === true;
}
