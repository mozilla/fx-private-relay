type CountryCode = string;
type LanguageCode = string;

type WaffleValue = [string, boolean][];

export type PlanData = {
  monthly: { id?: string; price: number; currency: string; url?: string };
  yearly: { id?: string; price: number; currency: string; url?: string };
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
  GA4_MEASUREMENT_ID: `G-${string}`;
  PERIODICAL_PREMIUM_PRODUCT_ID: `prod_${string}`;
  PHONE_PRODUCT_ID: `prod_${string}`;
  BUNDLE_PRODUCT_ID: `prod_${string}`;
  MEGABUNDLE_PRODUCT_ID: `prod_${string}`;
  PERIODICAL_PREMIUM_PLANS: ProductData<PlanData>;
  PHONE_PLANS: ProductData<PlanData>;
  BUNDLE_PLANS: ProductData<Pick<PlanData, "yearly">>;
  MEGABUNDLE_PLANS: ProductData<Pick<PlanData, "yearly">>;
  BASKET_ORIGIN: string;
  WAFFLE_FLAGS: WaffleValue;
  WAFFLE_SWITCHES: WaffleValue;
  WAFFLE_SAMPLES: WaffleValue;
  MAX_MINUTES_TO_VERIFY_REAL_PHONE: number;
  MAX_NUM_FREE_ALIASES: number;
};
