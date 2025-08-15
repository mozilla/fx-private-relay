import { RuntimeData } from "./types";

export const DEFAULT_RUNTIME_DATA: RuntimeData = {
  FXA_ORIGIN: "https://accounts.firefox.com",
  GOOGLE_ANALYTICS_ID: "UA-77033033-33",
  GA4_MEASUREMENT_ID: "G-YXT33S87LT",
  PERIODICAL_PREMIUM_PRODUCT_ID: "prod_KGizMiBqUJdYoY",
  PHONE_PRODUCT_ID: "prod_KGizMiBqUJdYoY",
  BUNDLE_PRODUCT_ID: "prod_MIex7Q079igFZJ",
  MEGABUNDLE_PRODUCT_ID: "prod_SOYBYCOWallcgz",
  BASKET_ORIGIN: "https://basket.mozilla.org",
  MAX_MINUTES_TO_VERIFY_REAL_PHONE: 5,
  WAFFLE_FLAGS: [
    ["free_user_onboarding", true],
    ["holiday_promo_2023", false],
    ["tracker_removal", true],
    ["four_mask_limit_upsell", true],
    ["interview_recruitment", false],
    ["intro_pricing_countdown", true],
    ["custom_domain_management_redesign", true],
    ["phones", true],
    ["bundle", true],
    ["phone_launch_survey", true],
    ["multi_replies", true],
    ["mask_redesign", true],
    ["welcome_email", true],
    ["mailing_list_announcement", true],
    ["eu_country_expansion", true],
    ["resender_headers", true],
  ],
  WAFFLE_SWITCHES: [],
  WAFFLE_SAMPLES: [],
  PERIODICAL_PREMIUM_PLANS: {
    country_code: "US",
    countries: [
      "AT",
      "BE",
      "BG",
      "CA",
      "CH",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "ES",
      "FI",
      "FR",
      "GB",
      "GR",
      "HR",
      "HU",
      "IE",
      "IT",
      "LT",
      "LU",
      "LV",
      "MT",
      "MY",
      "NL",
      "NZ",
      "PL",
      "PR",
      "PT",
      "RO",
      "SE",
      "SG",
      "SI",
      "SK",
      "US",
    ],
    available_in_country: true,
    plan_country_lang_mapping: {
      US: {
        "*": {
          monthly: {
            price: 1.99,
            currency: "USD",
            url: "https://payments.firefox.com/relaypremium/monthly/landing",
          },
          yearly: {
            price: 0.99,
            currency: "USD",
            url: "https://payments.firefox.com/relaypremium/yearly/landing",
          },
        },
      },
      // Insert the full plan_country_lang_mapping for all countries here
    },
  },
  PHONE_PLANS: {
    country_code: "US",
    countries: ["CA", "PR", "US"],
    available_in_country: true,
    plan_country_lang_mapping: {
      US: {
        "*": {
          monthly: {
            price: 4.99,
            currency: "USD",
            url: "https://payments.firefox.com/relaypremiumphone/monthly/landing",
          },
          yearly: {
            price: 3.99,
            currency: "USD",
            url: "https://payments.firefox.com/relaypremiumphone/yearly/landing",
          },
        },
      },
    },
  },
  BUNDLE_PLANS: {
    country_code: "US",
    countries: ["CA", "PR", "US"],
    available_in_country: true,
    plan_country_lang_mapping: {
      US: {
        "*": {
          yearly: {
            price: 6.99,
            currency: "USD",
            url: "https://payments.firefox.com/vpn-relay-bundle/yearly/landing",
          },
        },
      },
    },
  },
  MEGABUNDLE_PLANS: {
    country_code: "US",
    countries: ["US"],
    available_in_country: true,
    plan_country_lang_mapping: {
      US: {
        "*": {
          yearly: {
            price: 8.25,
            currency: "USD",
            url: "https://payments.firefox.com/privacyprotectionplan/yearly/landing",
          },
        },
      },
    },
  },
};
