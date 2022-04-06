import { CustomAliasData, RandomAliasData } from "../hooks/api/aliases";
import { ProfileData } from "../hooks/api/profile";
import { RuntimeData } from "../hooks/api/runtimeData";
import { UserData } from "../hooks/api/user";

export const mockIds = ["empty", "onboarding", "some", "full"] as const;

// This is the same for all mock users, at this time:
export const runtimeData: RuntimeData = {
  FXA_ORIGIN: "https://example.com",
  GOOGLE_ANALYTICS_ID: "UA-123456789-0",
  PREMIUM_PRODUCT_ID: "prod_123456789",
  PREMIUM_PLANS: {
    country_code: "nl",
    plan_country_lang_mapping: {
      nl: {
        nl: {
          id: "price_1JmROfJNcmPzuWtR6od8OfDW",
          price: "€0,99",
        },
      },
    },
    premium_countries: ["nl"],
    premium_available_in_country: true,
  },
};

export const users: Record<typeof mockIds[number], UserData> = {
  empty: { email: "empty@example.com" },
  onboarding: { email: "onboarding@example.com" },
  some: { email: "some@example.com" },
  full: { email: "full@example.com" },
};

export const profiles: Record<typeof mockIds[number], ProfileData> = {
  empty: {
    api_token: "empty",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/e",
    bounce_status: [false, ""],
    date_subscribed: null,
    has_premium: false,
    id: 0,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 0,
    server_storage: true,
    subdomain: null,
  },
  onboarding: {
    api_token: "onboarding",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/o",
    bounce_status: [false, ""],
    date_subscribed: "2020-04-09T00:00:00.000Z",
    has_premium: true,
    id: 0,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 0,
    server_storage: true,
    subdomain: null,
  },
  some: {
    api_token: "some",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/s",
    bounce_status: [false, ""],
    date_subscribed: "2020-04-09T00:00:00.000Z",
    has_premium: true,
    id: 0,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 3,
    server_storage: true,
    subdomain: null,
  },
  full: {
    api_token: "full",
    avatar: "https://profile.accounts.firefox.com/v1/avatar/f",
    bounce_status: [true, "soft"],
    date_subscribed: "2020-04-09T00:00:00.000Z",
    has_premium: true,
    id: 0,
    next_email_try: "2020-04-09T00:00:00.000Z",
    onboarding_state: 3,
    server_storage: true,
    subdomain: "mydomain",
  },
};
export const relayaddresses: Record<typeof mockIds[number], RandomAliasData[]> =
  {
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
        generated_for: "",
        id: 0,
        last_modified_at: "2020-04-09T00:00:00.000Z",
        last_used_at: "2020-04-09T00:00:00.000Z",
        num_blocked: 42,
        num_forwarded: 1337,
        num_spam: 0,
        type: "random",
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
        generated_for: "",
        id: 1,
        last_modified_at: "2020-04-09T00:00:00.000Z",
        last_used_at: "2020-04-09T00:00:00.000Z",
        num_blocked: 424242,
        num_forwarded: 0,
        num_spam: 0,
        type: "random",
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
        generated_for: "",
        id: 0,
        last_modified_at: "2020-04-09T00:00:00.000Z",
        last_used_at: "2020-04-09T00:00:00.000Z",
        num_blocked: 42,
        num_forwarded: 1337,
        num_spam: 0,
        type: "random",
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
        generated_for: "disneyplus.com",
        id: 1,
        last_modified_at: "2020-04-09T00:00:00.000Z",
        last_used_at: "2020-04-09T00:00:00.000Z",
        num_blocked: 424242,
        num_forwarded: 0,
        num_spam: 0,
        type: "random",
        used_on: "disneyplus.com,netflix.com",
      },
    ],
  };
export const domainaddresses: Record<
  typeof mockIds[number],
  CustomAliasData[]
> = {
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
      id: 1,
      last_modified_at: "2020-04-09T00:00:00.000Z",
      last_used_at: "2020-04-09T00:00:00.000Z",
      num_blocked: 424242,
      num_forwarded: 0,
      num_spam: 0,
      type: "custom",
    },
  ],
};
