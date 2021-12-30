import { jest } from "@jest/globals";
import { PremiumCountriesData, usePremiumCountries } from "../../../src/hooks/api/premiumCountries";

jest.mock("../../../src/hooks/api/premiumCountries");

// We know that `jest.mock` has turned `usePremiumCountries` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUsePremiumCountries = usePremiumCountries as jest.MockedFunction<
  typeof usePremiumCountries
>;

export function getMockPremiumCountriesDataWithPremium(): PremiumCountriesData {
  return {
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
    };
}
export function getMockPremiumCountriesDataWithoutPremium(): PremiumCountriesData {
  return {
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
    };
}

function getReturnValue(premiumCountriesData?: Partial<PremiumCountriesData>): ReturnType<typeof usePremiumCountries>  {
  return {
    isValidating: false,
    mutate: jest.fn(),
    data: {
      ...getMockPremiumCountriesDataWithPremium(),
      ...premiumCountriesData,
    },
  };
}

export const setMockPremiumCountriesData = (premiumCountriesData?: Partial<PremiumCountriesData>) => {
  mockedUsePremiumCountries.mockReturnValue(getReturnValue(premiumCountriesData));
};

export const setMockPremiumCountriesDataOnce = (premiumCountriesData?: Partial<PremiumCountriesData>) => {
  mockedUsePremiumCountries.mockReturnValueOnce(getReturnValue(premiumCountriesData));
};
