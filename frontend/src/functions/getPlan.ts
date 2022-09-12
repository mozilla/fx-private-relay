import { PlanData, ProductData, RuntimeData } from "../hooks/api/runtimeData";

const getPlan = <P extends Partial<PlanData>>(
  productData: ProductData<P>,
  billingPeriod: keyof P
) => {
  const languageCode = navigator.language.split("-")[0].toLowerCase();
  const countryPlans =
    productData.plan_country_lang_mapping[productData.country_code];
  const plan =
    countryPlans[languageCode] ?? countryPlans[Object.keys(countryPlans)[0]];

  return plan[billingPeriod];
};

export const getPeriodicalPremiumPrice = (
  runtimeData: RuntimeDataWithPeriodicalPremiumAvailable,
  billingPeriod: keyof PlanData
) => {
  return getPlan(runtimeData.PERIODICAL_PREMIUM_PLANS, billingPeriod).price;
};
/**
 * Given {@link RuntimeDataWithPeriodicalPremiumAvailable}, returns the URL the user should visit to purchase Premium.
 */
export const getPeriodicalPremiumSubscribeLink = (
  runtimeData: RuntimeDataWithPeriodicalPremiumAvailable,
  billingPeriod: keyof PlanData
) => {
  const plan = getPlan(runtimeData.PERIODICAL_PREMIUM_PLANS, billingPeriod);

  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PERIODICAL_PREMIUM_PRODUCT_ID}?plan=${plan.id}`;
};

export const getPhonesPrice = (
  runtimeData: RuntimeDataWithPhonesAvailable,
  billingPeriod: keyof PlanData
) => {
  return getPlan(runtimeData.PHONE_PLANS, billingPeriod).price;
};
export const getPhoneSubscribeLink = (
  runtimeData: RuntimeDataWithPhonesAvailable,
  billingPeriod: keyof PlanData
) => {
  const plan = getPlan(runtimeData.PHONE_PLANS, billingPeriod);
  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PHONE_PRODUCT_ID}?plan=${plan.id}`;
};

export const getBundlePrice = (runtimeData: RuntimeDataWithBundleAvailable) => {
  return getPlan(runtimeData.BUNDLE_PLANS, "yearly").price;
};
export const getBundleSubscribeLink = (
  runtimeData: RuntimeDataWithBundleAvailable
) => {
  const plan = getPlan(runtimeData.BUNDLE_PLANS, "yearly");
  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.BUNDLE_PRODUCT_ID}?plan=${plan.id}`;
};

/**
 * Helper type that is used to create helper types like
 * {@see RuntimeDataWithBundleAvailable}, which in turn can help make sure
 * functions like {@see isBundleAvailableInCountry} have been called.
 */
type RuntimeDataWithPlanAvailable<Plan extends keyof RuntimeData> =
  RuntimeData &
    Record<Plan, RuntimeData[Plan] & { available_in_country: true }>;
export type RuntimeDataWithPeriodicalPremiumAvailable =
  RuntimeDataWithPlanAvailable<"PERIODICAL_PREMIUM_PLANS">;
export type RuntimeDataWithPhonesAvailable =
  RuntimeDataWithPlanAvailable<"PHONE_PLANS">;
export type RuntimeDataWithBundleAvailable =
  RuntimeDataWithPlanAvailable<"BUNDLE_PLANS">;

export function isPeriodicalPremiumAvailableInCountry(
  runtimeData: RuntimeData | undefined
): runtimeData is RuntimeDataWithPeriodicalPremiumAvailable {
  return runtimeData?.PERIODICAL_PREMIUM_PLANS?.available_in_country === true;
}

export function isPhonesAvailableInCountry(
  runtimeData: RuntimeData | undefined
): runtimeData is RuntimeDataWithPhonesAvailable {
  return runtimeData?.PHONE_PLANS?.available_in_country === true;
}

export function isBundleAvailableInCountry(
  runtimeData: RuntimeData | undefined
): runtimeData is RuntimeDataWithBundleAvailable {
  return runtimeData?.BUNDLE_PLANS?.available_in_country === true;
}

// All functions below are deprecated, but includes for until we deprecate the
// introductory pricing for Relay Premium.

/**
 * Given {@link RuntimeDataWithPremiumAvailable}, selects the plan that is available to the current user.
 *
 * @deprecated See {@link getPlan}
 */
export const getPremiumPlan = (
  runtimeData: RuntimeDataWithPremiumAvailable
) => {
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
 *
 * @deprecated See {@link getPeriodicalPremiumSubscribeLink}
 */
export const getPremiumSubscribeLink = (
  runtimeData: RuntimeDataWithPremiumAvailable
) => {
  const plan = getPremiumPlan(runtimeData);

  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PREMIUM_PRODUCT_ID}?plan=${plan.id}`;
};

/**
 * This type ensures that {@link getPremiumPlan} and {@link getPremiumSubscribeLink} are not called
 * unless we can count on a plan being available for them to return
 * (i.e. after that's been checked with our user-defined type guard
 * {@link isPremiumAvailableInCountry}).
 *
 * @deprecated See {@link RuntimeDataWithPeriodicalPremiumAvailable}
 */
export type RuntimeDataWithPremiumAvailable = RuntimeData & {
  PREMIUM_PLANS: RuntimeData["PREMIUM_PLANS"] & {
    premium_available_in_country: true;
  };
};

/** @deprecated See {@link isPeriodicalPremiumAvailableInCountry} */
export function isPremiumAvailableInCountry(
  runtimeData: RuntimeData | undefined
): runtimeData is RuntimeDataWithPremiumAvailable {
  return runtimeData?.PREMIUM_PLANS?.premium_available_in_country === true;
}
