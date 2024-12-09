import {
  ProductData,
  RuntimeData,
  useRuntimeData,
} from "../../../src/hooks/api/runtimeData";

jest.mock("../../../src/hooks/api/runtimeData");

// We know that `jest.mock` has turned `useRuntimeData` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseRuntimeData = useRuntimeData as jest.MockedFunction<
  typeof useRuntimeData
>;

function getAvailableProductData(): ProductData {
  return {
    available_in_country: true,
    countries: ["NL"],
    country_code: "NL",
    plan_country_lang_mapping: {
      NL: {
        "*": {
          monthly: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: 0.99,
            currency: "EUR",
          },
          yearly: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: 0.99,
            currency: "EUR",
          },
        },
      },
    },
  };
}
function getUnavailableProductData(): ProductData {
  return {
    available_in_country: false,
    countries: [],
    country_code: "BE",
    plan_country_lang_mapping: {},
  };
}

export function getMockRuntimeDataWithBundle(): RuntimeData {
  return {
    FXA_ORIGIN: "https://fxa-mock.com",
    GOOGLE_ANALYTICS_ID: "UA-123456789-0",
    GA4_MEASUREMENT_ID: "G-4-measurement-id",
    PERIODICAL_PREMIUM_PRODUCT_ID: "prod_123456789",
    PHONE_PRODUCT_ID: "prod_123456789",
    BUNDLE_PRODUCT_ID: "prod_123456789",
    PERIODICAL_PREMIUM_PLANS: getAvailableProductData(),
    PHONE_PLANS: getAvailableProductData(),
    BUNDLE_PLANS: getAvailableProductData(),
    BASKET_ORIGIN: "https://basket-mock.com",
    WAFFLE_FLAGS: [],
    MAX_MINUTES_TO_VERIFY_REAL_PHONE: 5,
  };
}
export function getMockRuntimeDataWithPhones(): RuntimeData {
  return {
    FXA_ORIGIN: "https://fxa-mock.com",
    GOOGLE_ANALYTICS_ID: "UA-123456789-0",
    GA4_MEASUREMENT_ID: "G-4-measurement-id",
    PERIODICAL_PREMIUM_PRODUCT_ID: "prod_123456789",
    PHONE_PRODUCT_ID: "prod_123456789",
    BUNDLE_PRODUCT_ID: "prod_123456789",
    PERIODICAL_PREMIUM_PLANS: getAvailableProductData(),
    PHONE_PLANS: getAvailableProductData(),
    BUNDLE_PLANS: getUnavailableProductData(),
    BASKET_ORIGIN: "https://basket-mock.com",
    WAFFLE_FLAGS: [],
    MAX_MINUTES_TO_VERIFY_REAL_PHONE: 5,
  };
}
export function getMockRuntimeDataWithPeriodicalPremium(): RuntimeData {
  return {
    FXA_ORIGIN: "https://fxa-mock.com",
    GOOGLE_ANALYTICS_ID: "UA-123456789-0",
    GA4_MEASUREMENT_ID: "G-4-measurement-id",
    PERIODICAL_PREMIUM_PRODUCT_ID: "prod_123456789",
    PHONE_PRODUCT_ID: "prod_123456789",
    BUNDLE_PRODUCT_ID: "prod_123456789",
    PERIODICAL_PREMIUM_PLANS: getAvailableProductData(),
    PHONE_PLANS: getUnavailableProductData(),
    BUNDLE_PLANS: getUnavailableProductData(),
    BASKET_ORIGIN: "https://basket-mock.com",
    WAFFLE_FLAGS: [],
    MAX_MINUTES_TO_VERIFY_REAL_PHONE: 5,
  };
}
export function getMockRuntimeDataWithoutPremium(): RuntimeData {
  return {
    FXA_ORIGIN: "https://fxa-mock.com",
    GOOGLE_ANALYTICS_ID: "UA-123456789-0",
    GA4_MEASUREMENT_ID: "G-4-measurement-id",
    PERIODICAL_PREMIUM_PRODUCT_ID: "prod_123456789",
    PHONE_PRODUCT_ID: "prod_123456789",
    BUNDLE_PRODUCT_ID: "prod_123456789",
    PERIODICAL_PREMIUM_PLANS: getUnavailableProductData(),
    PHONE_PLANS: getUnavailableProductData(),
    BUNDLE_PLANS: getUnavailableProductData(),
    BASKET_ORIGIN: "https://basket-mock.com",
    WAFFLE_FLAGS: [],
    MAX_MINUTES_TO_VERIFY_REAL_PHONE: 5,
  };
}

function getReturnValue(
  runtimeData?: Partial<RuntimeData>,
): ReturnType<typeof useRuntimeData> {
  return {
    isValidating: false,
    mutate: jest.fn(),
    error: undefined,
    isLoading: false,
    data: {
      ...getMockRuntimeDataWithPeriodicalPremium(),
      ...runtimeData,
    },
  };
}

export const setMockRuntimeData = (runtimeData?: Partial<RuntimeData>) => {
  mockedUseRuntimeData.mockReturnValue(getReturnValue(runtimeData));
};

export const setMockRuntimeDataOnce = (runtimeData?: Partial<RuntimeData>) => {
  mockedUseRuntimeData.mockReturnValueOnce(getReturnValue(runtimeData));
};
