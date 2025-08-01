import { CustomAliasData, RandomAliasData } from "../hooks/api/aliases";
import { RealPhoneData } from "../hooks/api/realPhone";
import { RelayNumberData } from "../hooks/api/relayNumber";
import { InboundContactData } from "../hooks/api/inboundContact";
import { ProfileData } from "../hooks/api/profile";
import { RuntimeData } from "../hooks/api/runtimeData";
import { UserData } from "../hooks/api/user";

export const mockIds = ["demo", "empty", "onboarding", "some", "full"] as const;

// This is the same for all mock users, at this time:
export const mockedRuntimeData: RuntimeData = {
  // not sure if this is the mock url we want to use
  FXA_ORIGIN: "http://localhost/mock/fxa",
  BASKET_ORIGIN: "http://localhost/mock/basket",
  GOOGLE_ANALYTICS_ID: "UA-123456789-0",
  GA4_MEASUREMENT_ID: "G-YXT33S87LT",
  PERIODICAL_PREMIUM_PRODUCT_ID: "prod_123456789",
  PHONE_PRODUCT_ID: "prod_123456789",
  BUNDLE_PRODUCT_ID: "prod_123456789",
  MEGABUNDLE_PRODUCT_ID: "prod_123456789",
  PERIODICAL_PREMIUM_PLANS: {
    country_code: "NL",
    plan_country_lang_mapping: {
      NL: {
        "*": {
          monthly: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: 2.5,
            currency: "EUR",
            url: "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127/monthly/landing",
          },
          yearly: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: 1.99,
            currency: "EUR",
            url: "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127/yearly/landing",
          },
        },
      },
    },
    countries: ["NL"],
    available_in_country: true,
  },
  PHONE_PLANS: {
    country_code: "NL",
    plan_country_lang_mapping: {
      NL: {
        "*": {
          monthly: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: 5.99,
            currency: "EUR",
            url: "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127-phone/monthly/landing",
          },
          yearly: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: 4.99,
            currency: "EUR",
            url: "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/relay-premium-127-phone/yearly/landing",
          },
        },
      },
    },
    countries: ["NL"],
    available_in_country: true,
  },
  BUNDLE_PLANS: {
    country_code: "NL",
    plan_country_lang_mapping: {
      NL: {
        "*": {
          yearly: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: 8.99,
            currency: "EUR",
            url: "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/bundle-relay-vpn-dev/yearly/landing",
          },
        },
      },
    },
    countries: ["NL"],
    available_in_country: true,
  },
  MEGABUNDLE_PLANS: {
    country_code: "US",
    plan_country_lang_mapping: {
      US: {
        "*": {
          yearly: {
            id: "price_1RMAopKb9q6OnNsLSGe1vLtt",
            price: 8.25,
            currency: "USD",
            url: "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net/privacyprotectionplan/yearly/landing",
          },
        },
      },
    },
    countries: ["US"],
    available_in_country: true,
  },
  WAFFLE_FLAGS: [
    ["tracker_removal", true],
    ["phone_launch_survey", true],
    ["multi_replies", true],
    ["firefox_integration", true],
    ["premium_promo_banners", false],
    ["mask_redesign", true],
    ["custom_domain_management_redesign", true],
  ],
  MAX_MINUTES_TO_VERIFY_REAL_PHONE: 5,
};

export const mockedUsers: Record<(typeof mockIds)[number], UserData> = {
  demo: { email: "jfoxfire@mozilla.com" },
  empty: { email: "empty@example.com" },
  onboarding: { email: "onboarding@example.com" },
  some: { email: "some@example.com" },
  full: { email: "full@example.com" },
};

export const mockedProfiles: Record<(typeof mockIds)[number], ProfileData> = {
  demo: {
    api_token: "demo",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/j",
    bounce_status: [false, ""],
    date_subscribed: null,
    remove_level_one_email_trackers: false,
    has_premium: true,
    has_phone: true,
    has_vpn: true,
    has_megabundle: false,
    id: 4,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 3,
    onboarding_free_state: 3,
    forwarded_first_reply: true,
    server_storage: true,
    store_phone_log: true,
    subdomain: "foxmask",
    emails_blocked: 23,
    emails_forwarded: 30,
    emails_replied: 0,
    level_one_trackers_blocked: 0,
    metrics_enabled: true,
  },
  empty: {
    api_token: "empty",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/e",
    bounce_status: [false, ""],
    date_subscribed: null,
    remove_level_one_email_trackers: false,
    has_premium: false,
    has_phone: false,
    has_vpn: false,
    has_megabundle: false,
    id: 0,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 0,
    onboarding_free_state: 0,
    forwarded_first_reply: false,
    server_storage: true,
    store_phone_log: true,
    subdomain: null,
    emails_blocked: 0,
    emails_forwarded: 0,
    emails_replied: 0,
    level_one_trackers_blocked: 0,
    metrics_enabled: true,
  },
  onboarding: {
    api_token: "onboarding",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/o",
    bounce_status: [false, ""],
    date_subscribed: "2020-04-09T00:00:00.000Z",
    remove_level_one_email_trackers: false,
    has_premium: true,
    has_phone: true,
    has_vpn: false,
    has_megabundle: false,
    id: 1,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 0,
    onboarding_free_state: 0,
    forwarded_first_reply: false,
    server_storage: true,
    subdomain: null,
    emails_blocked: 0,
    emails_forwarded: 0,
    emails_replied: 0,
    level_one_trackers_blocked: 0,
    store_phone_log: true,
    metrics_enabled: true,
  },
  some: {
    api_token: "some",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/s",
    bounce_status: [false, ""],
    date_subscribed: "2020-04-09T00:00:00.000Z",
    remove_level_one_email_trackers: false,
    has_premium: true,
    has_phone: true,
    has_vpn: false,
    has_megabundle: false,
    id: 2,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 3,
    onboarding_free_state: 3,
    forwarded_first_reply: true,
    server_storage: true,
    subdomain: null,
    emails_blocked: 424284,
    emails_forwarded: 1337,
    emails_replied: 40,
    level_one_trackers_blocked: 72,
    store_phone_log: true,
    metrics_enabled: true,
  },
  full: {
    api_token: "full",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/f",
    bounce_status: [true, "soft"],
    date_subscribed: "2020-04-09T00:00:00.000Z",
    remove_level_one_email_trackers: true,
    has_premium: true,
    has_phone: true,
    has_vpn: true,
    has_megabundle: false,
    id: 3,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 3,
    onboarding_free_state: 3,
    forwarded_first_reply: true,
    server_storage: true,
    subdomain: "mydomain",
    emails_blocked: 848526,
    emails_forwarded: 1337,
    emails_replied: 9631,
    level_one_trackers_blocked: 1409,
    store_phone_log: true,
    metrics_enabled: true,
  },
};
export const mockedRelayaddresses: Record<
  (typeof mockIds)[number],
  RandomAliasData[]
> = {
  demo: [
    {
      address: "207ylqt0h",
      full_address: "207ylqt0h@mozmail.com",
      created_at: "2023-05-11T17:25:35.556Z",
      description: "Restaurants",
      domain: 1,
      enabled: false,
      block_list_emails: true,
      block_level_one_trackers: false,
      generated_for: "grubhub.com",
      id: 0,
      last_modified_at: "2023-05-11T17:25:35.556Z",
      last_used_at: "2023-05-11T17:25:35.556Z",
      num_blocked: 0,
      num_forwarded: 2,
      num_replied: 0,
      num_spam: 0,
      num_level_one_trackers_blocked: 0,
      mask_type: "random",
      used_on: "grubhub.com",
    },
    {
      address: "4mptbp2r0",
      full_address: "4mptbp2r0@mozmail.com",
      created_at: "2023-05-11T17:23:48.858Z",
      description: "Online Shopping",
      domain: 1,
      enabled: true,
      block_list_emails: true,
      block_level_one_trackers: false,
      generated_for: "",
      id: 1,
      last_modified_at: "2023-05-11T17:23:48.858Z",
      last_used_at: "2023-05-11T17:23:48.858Z",
      num_blocked: 23,
      num_forwarded: 28,
      num_replied: 0,
      num_spam: 0,
      num_level_one_trackers_blocked: 0,
      mask_type: "random",
      used_on: "",
    },
    {
      address: "1h8vu6nkz",
      full_address: "1h8vu6nkz@mozmail.com",
      created_at: "2023-05-15T17:14:10.880Z",
      description: "News",
      domain: 1,
      enabled: true,
      block_list_emails: false,
      block_level_one_trackers: false,
      generated_for: "",
      id: 2,
      last_modified_at: "2023-05-15T17:14:10.880Z",
      last_used_at: "2023-05-15T17:14:10.880Z",
      num_blocked: 0,
      num_forwarded: 0,
      num_replied: 0,
      num_spam: 0,
      num_level_one_trackers_blocked: 0,
      mask_type: "random",
      used_on: "",
    },
  ],
  empty: [],
  onboarding: [],
  some: [
    {
      address: "random_0",
      full_address: "random_0@mozmail.com",
      created_at: "2020-04-09T00:00:00.000Z",
      description: "A label",
      domain: 1,
      enabled: true,
      block_list_emails: true,
      block_level_one_trackers: false,
      generated_for: "",
      id: 0,
      last_modified_at: "2020-04-09T00:00:00.000Z",
      last_used_at: "2020-04-09T00:00:00.000Z",
      num_blocked: 42,
      num_forwarded: 1337,
      num_replied: 20,
      num_spam: 0,
      num_level_one_trackers_blocked: 72,
      mask_type: "random",
      used_on: "",
    },
    {
      address: "random_1",
      full_address: "random_1@mozmail.com",
      created_at: "2020-04-09T00:00:00.000Z",
      description: "",
      domain: 1,
      enabled: false,
      block_list_emails: false,
      block_level_one_trackers: false,
      generated_for: "",
      id: 1,
      last_modified_at: "2020-04-09T00:00:00.000Z",
      last_used_at: "2020-04-09T00:00:00.000Z",
      num_blocked: 424242,
      num_forwarded: 0,
      num_replied: 20,
      num_spam: 0,
      num_level_one_trackers_blocked: 0,
      mask_type: "random",
      used_on: "",
    },
  ],
  full: [
    {
      address: "random_0",
      full_address: "random_0@mozmail.com",
      created_at: "2020-04-09T00:00:00.000Z",
      description: "A label",
      domain: 1,
      enabled: true,
      block_list_emails: false,
      block_level_one_trackers: true,
      generated_for: "",
      id: 0,
      last_modified_at: "2020-04-09T00:00:00.000Z",
      last_used_at: "2020-04-09T00:00:00.000Z",
      num_blocked: 42,
      num_forwarded: 1337,
      num_replied: 201,
      num_spam: 0,
      num_level_one_trackers_blocked: 0,
      mask_type: "random",
      used_on: "",
    },
    {
      address: "random_1",
      full_address: "random_1@mozmail.com",
      created_at: "2020-04-09T00:00:00.000Z",
      description: "",
      domain: 1,
      enabled: false,
      block_list_emails: false,
      block_level_one_trackers: true,
      generated_for: "disneyplus.com",
      id: 1,
      last_modified_at: "2020-04-09T00:00:00.000Z",
      last_used_at: "2020-04-09T00:00:00.000Z",
      num_blocked: 424242,
      num_forwarded: 0,
      num_replied: 310,
      num_spam: 0,
      num_level_one_trackers_blocked: 72,
      mask_type: "random",
      used_on: "disneyplus.com,netflix.com",
    },
  ],
};
export const mockedDomainaddresses: Record<
  (typeof mockIds)[number],
  CustomAliasData[]
> = {
  demo: [],
  empty: [],
  onboarding: [],
  some: [],
  full: [
    {
      address: "custom_0",
      full_address: "custom_0@custom.mozmail.com",
      created_at: "2020-04-09T00:00:00.000Z",
      description: "",
      domain: 2,
      enabled: true,
      block_list_emails: true,
      block_level_one_trackers: true,
      id: 1,
      last_modified_at: "2020-04-09T00:00:00.000Z",
      last_used_at: "2020-04-09T00:00:00.000Z",
      num_blocked: 424242,
      num_forwarded: 0,
      num_replied: 9120,
      num_spam: 0,
      num_level_one_trackers_blocked: 1337,
      mask_type: "custom",
      used_on: "",
    },
  ],
};

export const mockedRealphones: Record<(typeof mockIds)[number], RealPhoneData> =
  {
    demo: [],
    empty: [],
    onboarding: [],
    some: [
      {
        id: 0,
        number: "+14155552671",
        verification_code: "123456",
        verification_sent_date: "2022-07-27T10:17:29.775Z",
        verified: true,
        verified_date: "2022-07-27T10:18:01.801Z",
        country_code: "US",
      },
    ],
    full: [
      {
        id: 0,
        number: "+14155552671",
        verification_code: "123456",
        verification_sent_date: "2022-07-27T10:17:29.775Z",
        verified: true,
        verified_date: "2022-07-27T10:18:01.801Z",
        country_code: "US",
      },
    ],
  };

export const mockedRelaynumbers: Record<
  (typeof mockIds)[number],
  RelayNumberData
> = {
  demo: [],
  empty: [],
  onboarding: [],
  some: [
    {
      id: 0,
      number: "+18089251571",
      location: "Hilo",
      country_code: "US",
      enabled: true,
      remaining_texts: 74,
      remaining_minutes: 49,
      calls_forwarded: 3,
      calls_blocked: 1,
      texts_forwarded: 17,
      texts_blocked: 5,
      calls_and_texts_forwarded: 20,
      calls_and_texts_blocked: 6,
    },
  ],
  full: [
    {
      id: 0,
      number: "+18089251571",
      location: "Hilo",
      country_code: "US",
      enabled: true,
      remaining_texts: 74,
      remaining_minutes: 49,
      calls_forwarded: 3,
      calls_blocked: 1,
      texts_forwarded: 17,
      texts_blocked: 5,
      calls_and_texts_forwarded: 20,
      calls_and_texts_blocked: 6,
    },
  ],
};

export const mockedInboundContacts: Record<
  (typeof mockIds)[number],
  InboundContactData
> = {
  demo: [],
  empty: [],
  onboarding: [],
  some: [
    {
      id: 0,
      relay_number: 150,
      inbound_number: "+18089251571",
      last_inbound_date: "2022-07-27T10:18:01.801Z",
      last_inbound_type: "call",
      num_calls: 45,
      num_calls_blocked: 3,
      last_call_date: "2022-07-27T10:18:01.801Z",
      num_texts: 13,
      num_texts_blocked: 18,
      last_text_date: "2022-07-25T09:17:00.800Z",
      blocked: false,
    },
  ],
  full: [
    {
      id: 0,
      relay_number: 150,
      inbound_number: "+18089251571",
      last_inbound_date: "2022-07-27T10:18:01.801Z",
      last_inbound_type: "text",
      num_calls: 45,
      num_calls_blocked: 3,
      last_call_date: "2022-07-26T09:17:00.800Z",
      num_texts: 13,
      num_texts_blocked: 18,
      last_text_date: "2022-07-27T10:18:01.801Z",
      blocked: false,
    },
    {
      id: 1,
      relay_number: 150,
      inbound_number: "+18089251571",
      last_inbound_date: new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString(),
      last_inbound_type: "text",
      num_calls: 45,
      num_calls_blocked: 3,
      last_call_date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      num_texts: 13,
      num_texts_blocked: 18,
      last_text_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      blocked: false,
    },
    {
      id: 2,
      relay_number: 150,
      inbound_number: "+18089251571",
      last_inbound_date: new Date().toISOString(),
      last_inbound_type: "text",
      num_calls: 45,
      num_calls_blocked: 3,
      last_call_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      num_texts: 13,
      num_texts_blocked: 18,
      last_text_date: new Date().toISOString(),
      blocked: false,
    },
  ],
};
