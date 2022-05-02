import {
  RuntimeData,
  useRuntimeData,
} from "../../../src/hooks/api/runtimeData";

jest.mock("../../../src/hooks/api/runtimeData");

// We know that `jest.mock` has turned `useRuntimeData` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseRuntimeData = useRuntimeData as jest.MockedFunction<
  typeof useRuntimeData
>;

export function getMockRuntimeDataWithPremium(): RuntimeData {
  return {
    FXA_ORIGIN: "https://fxa-mock.com",
    BASKET_ORIGIN: "https://basket-mock.com",
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
}
export function getMockRuntimeDataWithoutPremium(): RuntimeData {
  return {
    FXA_ORIGIN: "https://fxa-mock.com",
    BASKET_ORIGIN: "https://basket-mock.com",
    GOOGLE_ANALYTICS_ID: "UA-123456789-0",
    PREMIUM_PRODUCT_ID: "prod_123456789",
    PREMIUM_PLANS: {
      country_code: "be",
      plan_country_lang_mapping: {
        nl: {
          nl: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: "€0,99",
          },
        },
      },
      premium_countries: ["nl"],
      premium_available_in_country: false,
    },
  };
}

function getReturnValue(
  runtimeData?: Partial<RuntimeData>
): ReturnType<typeof useRuntimeData> {
  return {
    isValidating: false,
    mutate: jest.fn(),
    data: {
      ...getMockRuntimeDataWithPremium(),
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
