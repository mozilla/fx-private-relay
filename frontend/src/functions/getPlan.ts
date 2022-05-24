import { RuntimeData } from "../hooks/api/runtimeData";

/**
 * Given {@link RuntimeDataWithPremiumAvailable}, selects the plan that is available to the current user.
 */
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

/**
 * Given {@link RuntimeDataWithPremiumAvailable}, returns the URL the user should visit to purchase Premium.
 */
export const getPremiumSubscribeLink = (
  runtimeData: RuntimeDataWithPremiumAvailable
) => {
  const plan = getPlan(runtimeData);

  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PREMIUM_PRODUCT_ID}?plan=${plan.id}`;
};

export const getPhoneSubscribeLink = (runtimeData: RuntimeData | undefined) => {
  if (runtimeData === undefined) {
    return undefined;
  }
  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PHONE_PRODUCT_ID}`;
};

/**
 * This type ensures that {@link getPlan} and {@link getPremiumSubscribeLink} are not called
 * unless we can count on a plan being available for them to return
 * (i.e. after that's been checked with our user-defined type guard
 * {@link isPremiumAvailableInCountry}).
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
