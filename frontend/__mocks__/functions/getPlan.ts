import { RuntimeData } from "../../src/hooks/api/types";

export const isMegabundleAvailableInCountry = (
  runtimeData: RuntimeData,
): boolean => !!runtimeData?.MEGABUNDLE_PLANS?.available_in_country;

export const isBundleAvailableInCountry = (runtimeData: RuntimeData): boolean =>
  !!runtimeData?.BUNDLE_PLANS?.available_in_country;

export const isPhonesAvailableInCountry = (runtimeData: RuntimeData): boolean =>
  !!runtimeData?.PHONE_PLANS?.available_in_country;

export const isPeriodicalPremiumAvailableInCountry = (
  runtimeData: RuntimeData,
): boolean => !!runtimeData?.PERIODICAL_PREMIUM_PLANS?.available_in_country;

export const getBundlePrice = (): string => "$10";
export const getBundleYearlyPrice = (): string => "$100";
export const getBundleSubscribeLink = (): string =>
  "https://subscribe.megabundle.mock";

export const getPhonesPrice = (): string => "$5";
export const getPhonesYearlyPrice = (): string => "$50";
export const getPhoneSubscribeLink = (): string => "/subscribe/phones";

export const getPeriodicalPremiumPrice = (): string => "$3";
export const getPeriodicalPremiumYearlyPrice = (): string => "$30";
export const getPeriodicalPremiumSubscribeLink = (): string =>
  "/subscribe/premium";
