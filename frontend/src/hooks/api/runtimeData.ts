import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

type CountryCode = string;
type LanguageCode = string;
export type FlagNames =
  | "custom_domain_management_redesign"
  | "manage_flags"
  | "interview_recruitment"
  | "tracker_removal"
  | "phone_launch_survey"
  | "multi_replies"
  | "free_user_onboarding"
  | "firefox_integration"
  | "mailing_list_announcement"
  | "premium_promo_banners"
  | "mask_redesign"
  | "mobile_app";

type WaffleFlag = [FlagNames, boolean];

export type PlanData = {
  monthly: { id: string; price: number; currency: string };
  yearly: { id: string; price: number; currency: string };
};

export type ProductData<P extends Partial<PlanData> = PlanData> = {
  country_code: CountryCode;
  countries: CountryCode[];
  available_in_country: boolean;
  plan_country_lang_mapping: Record<CountryCode, Record<LanguageCode, P>>;
};

export type RuntimeData = {
  FXA_ORIGIN: string;
  GOOGLE_ANALYTICS_ID: `UA-${number}-${number}`;
  PERIODICAL_PREMIUM_PRODUCT_ID: `prod_${string}`;
  PHONE_PRODUCT_ID: `prod_${string}`;
  BUNDLE_PRODUCT_ID: `prod_${string}`;
  PERIODICAL_PREMIUM_PLANS: ProductData<PlanData>;
  PHONE_PLANS: ProductData<PlanData>;
  BUNDLE_PLANS: ProductData<Pick<PlanData, "yearly">>;
  BASKET_ORIGIN: string;
  WAFFLE_FLAGS: WaffleFlag[];
  MAX_MINUTES_TO_VERIFY_REAL_PHONE: number;
};

/**
 * Fetch data from the back-end that wasn't known at build time (e.g. the user's country, or environment variables) using [SWR](https://swr.vercel.app).
 */
export function useRuntimeData() {
  const runtimeData: SWRResponse<RuntimeData, unknown> = useApiV1(
    "/runtime_data",
    {
      // Runtime data rarely changes, so we shouldn't need to refetch it
      // multiple times during the user's session
      // (their main use is allowing for different values on different
      // environments, even though those values are static over time):
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  return runtimeData;
}
