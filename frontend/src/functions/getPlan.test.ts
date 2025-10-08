import {
  getPeriodicalPremiumSubscribeLink,
  getPhoneSubscribeLink,
  getBundleSubscribeLink,
  getMegabundleSubscribeLink,
  getMegabundlePrice,
  getMegabundleYearlyPrice,
  RuntimeDataWithPeriodicalPremiumAvailable,
  RuntimeDataWithPhonesAvailable,
  RuntimeDataWithBundleAvailable,
  getPeriodicalPremiumPrice,
  getPhonesPrice,
  getBundlePrice,
  getBundleDiscountPercentage,
  getIndividualBundlePrice,
  isPeriodicalPremiumAvailableInCountry,
  isPhonesAvailableInCountry,
  isBundleAvailableInCountry,
  isMegabundleAvailableInCountry,
} from "./getPlan";
import { mockedRuntimeData } from "../../__mocks__/api/mockData";
import { PlanData } from "../hooks/api/types";
import { ReactLocalization } from "@fluent/react";

const sp2LinkPrefix = `${mockedRuntimeData.FXA_ORIGIN}/subscriptions/products`;
const sp3LinkPrefix =
  "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net";
const mockDataPlanID = "price_1JmROfJNcmPzuWtR6od8OfDW";
const billingPeriod = "yearly";
const country = "NL";
const lang = "*";

const mockL10n = {
  bundles: [],
  getString: () => "",
} as unknown as ReactLocalization;

type PlanDetails = {
  id?: string;
  url?: string;
  price?: number;
  currency?: string;
};

type PlanMapping = {
  [country: string]: {
    [lang: string]: {
      [period in keyof PlanData]?: PlanDetails;
    };
  };
};

type CountryCode = string;

// Utility to ensure nested structure exists
function ensurePlan(
  runtimeDataSection: {
    country_code?: CountryCode;
    countries?: CountryCode[];
    available_in_country?: boolean;
    plan_country_lang_mapping: PlanMapping;
  },
  billingPeriod: keyof PlanData,
) {
  runtimeDataSection.plan_country_lang_mapping[country] ??= {};
  runtimeDataSection.plan_country_lang_mapping[country][lang] ??= {};
  runtimeDataSection.plan_country_lang_mapping[country][lang][billingPeriod] ??=
    {};
  return runtimeDataSection.plan_country_lang_mapping[country][lang][
    billingPeriod
  ];
}

describe("SubscribeLink Tests", () => {
  const testCases = [
    { billingPeriod: "monthly", planIdPresent: true },
    { billingPeriod: "yearly", planIdPresent: true },
    { billingPeriod: "monthly", planIdPresent: false },
    { billingPeriod: "yearly", planIdPresent: false },
  ] as const;

  testCases.forEach(({ billingPeriod, planIdPresent }) => {
    it(`getPeriodicalPremiumSubscribeLink should return correct link for billingPeriod: ${billingPeriod} (planIdPresent: ${planIdPresent})`, () => {
      const planId = planIdPresent ? mockDataPlanID : "";
      const plan = ensurePlan(
        mockedRuntimeData.PERIODICAL_PREMIUM_PLANS,
        billingPeriod,
      );
      plan.id = planId;
      plan.url = `${sp3LinkPrefix}/relay-premium-127/${billingPeriod}/landing`;

      const link = getPeriodicalPremiumSubscribeLink(
        mockedRuntimeData as RuntimeDataWithPeriodicalPremiumAvailable,
        billingPeriod as keyof PlanData,
      );

      const expectedLink = planIdPresent
        ? `${sp2LinkPrefix}/${mockedRuntimeData.PERIODICAL_PREMIUM_PRODUCT_ID}?plan=${planId}`
        : plan.url;

      expect(link).toBe(expectedLink);
    });
  });

  testCases.forEach(({ billingPeriod, planIdPresent }) => {
    it(`getPhoneSubscribeLink should return correct link for billingPeriod: ${billingPeriod} (planIdPresent: ${planIdPresent})`, () => {
      const planId = planIdPresent ? mockDataPlanID : "";
      const plan = ensurePlan(mockedRuntimeData.PHONE_PLANS, billingPeriod);
      plan.id = planId;
      plan.url = `${sp3LinkPrefix}/relay-premium-127-phone/${billingPeriod}/landing`;

      const link = getPhoneSubscribeLink(
        mockedRuntimeData as RuntimeDataWithPhonesAvailable,
        billingPeriod as keyof PlanData,
      );

      const expectedLink = planIdPresent
        ? `${sp2LinkPrefix}/${mockedRuntimeData.PHONE_PRODUCT_ID}?plan=${planId}`
        : plan.url;

      expect(link).toBe(expectedLink);
    });
  });

  [true, false].forEach((planIdPresent) => {
    it(`getBundleSubscribeLink should return correct link for billingPeriod: yearly (planIdPresent: ${planIdPresent})`, () => {
      const planId = planIdPresent ? mockDataPlanID : "";
      const plan = ensurePlan(mockedRuntimeData.BUNDLE_PLANS, "yearly");
      plan.id = planId;
      plan.url = `${sp3LinkPrefix}/bundle-relay-vpn-dev/yearly/landing`;

      const link = getBundleSubscribeLink(
        mockedRuntimeData as RuntimeDataWithBundleAvailable,
      );

      const expectedLink = planIdPresent
        ? `${sp2LinkPrefix}/${mockedRuntimeData.BUNDLE_PRODUCT_ID}?plan=${planId}`
        : plan.url;

      expect(link).toBe(expectedLink);
    });
  });
});

describe("Megabundle Tests", () => {
  [true, false].forEach((planIdPresent) => {
    it(`getMegabundleSubscribeLink should return correct link for planIdPresent: ${planIdPresent}`, () => {
      const planId = planIdPresent ? mockDataPlanID : "";
      const plan = ensurePlan(
        mockedRuntimeData.MEGABUNDLE_PLANS,
        billingPeriod,
      );
      plan.id = planId;
      plan.url = `${sp3LinkPrefix}/megabundle-relay-vpn-dev/${billingPeriod}/landing`;

      const link = getMegabundleSubscribeLink(
        mockedRuntimeData as RuntimeDataWithBundleAvailable,
      );

      const expectedLink =
        "http://localhost/mock/fxa/subscriptions/products/prod_123456789?plan=price_1RMAopKb9q6OnNsLSGe1vLtt";

      expect(link).toBe(expectedLink);
    });
  });

  it("getMegabundlePrice should return formatted price", () => {
    const price = 8.25;
    const currency = "USD";
    const plan = ensurePlan(mockedRuntimeData.MEGABUNDLE_PLANS, billingPeriod);
    plan.price = price;
    plan.currency = currency;

    const formatted = getMegabundlePrice(
      mockedRuntimeData as RuntimeDataWithBundleAvailable,
      mockL10n,
    );

    const expected = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);

    expect(formatted).toBe(expected);
  });

  it("getMegabundleYearlyPrice should return formatted yearly price", () => {
    const price = 8.25;
    const currency = "USD";
    const plan = ensurePlan(mockedRuntimeData.MEGABUNDLE_PLANS, billingPeriod);
    plan.price = price;
    plan.currency = currency;

    const formatted = getMegabundleYearlyPrice(
      mockedRuntimeData as RuntimeDataWithBundleAvailable,
      mockL10n,
    );

    const expected = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price * 12);

    expect(formatted).toBe(expected);
  });

  it("getBundleDiscountPercentage should return discount percentage as number", () => {
    const price = 8.25;
    const plan = ensurePlan(mockedRuntimeData.MEGABUNDLE_PLANS, "yearly");
    plan.price = price;

    const individual = getIndividualBundlePrice("monthly");
    const ratio = price / individual;
    const expectedDiscount = Math.ceil((1 - ratio) * 100);

    const result = getBundleDiscountPercentage(
      mockedRuntimeData as RuntimeDataWithBundleAvailable,
    );

    expect(result).toBe(expectedDiscount);
  });
});

describe("Price Formatting Tests", () => {
  it("getPeriodicalPremiumPrice should return formatted price", () => {
    const plan = ensurePlan(
      mockedRuntimeData.PERIODICAL_PREMIUM_PLANS,
      billingPeriod,
    );
    plan.price = 3.99;
    plan.currency = "EUR";

    const result = getPeriodicalPremiumPrice(
      mockedRuntimeData as RuntimeDataWithPeriodicalPremiumAvailable,
      billingPeriod,
      mockL10n,
    );

    expect(result).toBe(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
      }).format(3.99),
    );
  });

  it("getPhonesPrice should return formatted price", () => {
    const plan = ensurePlan(mockedRuntimeData.PHONE_PLANS, billingPeriod);
    plan.price = 2.5;
    plan.currency = "USD";

    const result = getPhonesPrice(
      mockedRuntimeData as RuntimeDataWithPhonesAvailable,
      billingPeriod,
      mockL10n,
    );

    expect(result).toBe(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(2.5),
    );
  });

  it("getBundlePrice should return formatted price", () => {
    const plan = ensurePlan(mockedRuntimeData.BUNDLE_PLANS, "yearly");
    plan.price = 19.99;
    plan.currency = "CAD";

    const result = getBundlePrice(
      mockedRuntimeData as RuntimeDataWithBundleAvailable,
      mockL10n,
    );

    expect(result).toBe(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "CAD",
      }).format(19.99),
    );
  });

  it("getIndividualBundlePrice should return correct yearly and monthly prices", () => {
    expect(getIndividualBundlePrice("monthly")).toBe(14.99);
    expect(getIndividualBundlePrice("yearly")).toBe(14.99 * 12);
  });
});

describe("Availability Guard Functions", () => {
  it("isPeriodicalPremiumAvailableInCountry should return true when available", () => {
    mockedRuntimeData.PERIODICAL_PREMIUM_PLANS.available_in_country = true;
    expect(isPeriodicalPremiumAvailableInCountry(mockedRuntimeData)).toBe(true);
  });

  it("isPhonesAvailableInCountry should return true when available", () => {
    mockedRuntimeData.PHONE_PLANS.available_in_country = true;
    expect(isPhonesAvailableInCountry(mockedRuntimeData)).toBe(true);
  });

  it("isBundleAvailableInCountry should return true when available", () => {
    mockedRuntimeData.BUNDLE_PLANS.available_in_country = true;
    expect(isBundleAvailableInCountry(mockedRuntimeData)).toBe(true);
  });

  it("isMegabundleAvailableInCountry should return true when available", () => {
    mockedRuntimeData.MEGABUNDLE_PLANS.available_in_country = true;
    expect(isMegabundleAvailableInCountry(mockedRuntimeData)).toBe(true);
  });
});
