import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

type CountryCode = string;
type LanguageCode = string;
export type PremiumPlans = {
  country_code: CountryCode;
  premium_countries: CountryCode[];
  premium_available_in_country: boolean;
  plan_country_lang_mapping: Record<
    CountryCode,
    Record<LanguageCode, { id: string; price: string }>
  >;
};
export type RuntimeData = {
  FXA_ORIGIN: string;
  GOOGLE_ANALYTICS_ID: `UA-${number}-${number}`;
  PREMIUM_PRODUCT_ID: `prod_${string}`;
  PREMIUM_PLANS: PremiumPlans;
  BASKET_ORIGIN: string;
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
    }
  );
  return runtimeData;
}
