import { ReactLocalization } from "@fluent/react";
import { PlanData, ProductData, RuntimeData } from "../hooks/api/runtimeData";
import { getLocale } from "./getLocale";

const getPlan = <P extends Partial<PlanData>>(
  productData: ProductData<P>,
  billingPeriod: keyof P,
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
  billingPeriod: keyof PlanData,
  l10n: ReactLocalization,
) => {
  const plan = getPlan(runtimeData.PERIODICAL_PREMIUM_PLANS, billingPeriod);
  const formatter = new Intl.NumberFormat(getLocale(l10n), {
    style: "currency",
    currency: plan.currency,
  });
  return formatter.format(plan.price);
};
/**
 * Given {@link RuntimeDataWithPeriodicalPremiumAvailable}, returns the URL the user should visit to purchase Premium.
 */
export const getPeriodicalPremiumSubscribeLink = (
  runtimeData: RuntimeDataWithPeriodicalPremiumAvailable,
  billingPeriod: keyof PlanData,
) => {
  const plan = getPlan(runtimeData.PERIODICAL_PREMIUM_PLANS, billingPeriod);

  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PERIODICAL_PREMIUM_PRODUCT_ID}?plan=${plan.id}`;
};

export const getPhonesPrice = (
  runtimeData: RuntimeDataWithPhonesAvailable,
  billingPeriod: keyof PlanData,
  l10n: ReactLocalization,
) => {
  const plan = getPlan(runtimeData.PHONE_PLANS, billingPeriod);
  const formatter = new Intl.NumberFormat(getLocale(l10n), {
    style: "currency",
    currency: plan.currency,
  });
  return formatter.format(plan.price);
};
export const getPhoneSubscribeLink = (
  runtimeData: RuntimeDataWithPhonesAvailable,
  billingPeriod: keyof PlanData,
) => {
  const plan = getPlan(runtimeData.PHONE_PLANS, billingPeriod);
  return `${runtimeData.FXA_ORIGIN}/subscriptions/products/${runtimeData.PHONE_PRODUCT_ID}?plan=${plan.id}`;
};

export const getBundlePrice = (
  runtimeData: RuntimeDataWithBundleAvailable,
  l10n: ReactLocalization,
) => {
  const plan = getPlan(runtimeData.BUNDLE_PLANS, "yearly");
  const formatter = new Intl.NumberFormat(getLocale(l10n), {
    style: "currency",
    currency: plan.currency,
  });
  return formatter.format(plan.price);
};
export const getBundleSubscribeLink = (
  runtimeData: RuntimeDataWithBundleAvailable,
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
  runtimeData: RuntimeData | undefined,
): runtimeData is RuntimeDataWithPeriodicalPremiumAvailable {
  return runtimeData?.PERIODICAL_PREMIUM_PLANS?.available_in_country === true;
}

export function isPhonesAvailableInCountry(
  runtimeData: RuntimeData | undefined,
): runtimeData is RuntimeDataWithPhonesAvailable {
  return runtimeData?.PHONE_PLANS?.available_in_country === true;
}

export function isBundleAvailableInCountry(
  runtimeData: RuntimeData | undefined,
): runtimeData is RuntimeDataWithBundleAvailable {
  return runtimeData?.BUNDLE_PLANS?.available_in_country === true;
}
