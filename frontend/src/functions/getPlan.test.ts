import {
  getPeriodicalPremiumSubscribeLink,
  getPhoneSubscribeLink,
  getBundleSubscribeLink,
  RuntimeDataWithPeriodicalPremiumAvailable,
  RuntimeDataWithPhonesAvailable,
  RuntimeDataWithBundleAvailable,
} from "./getPlan";
import { mockedRuntimeData } from "../apiMocks/mockData";
import { PlanData } from "../hooks/api/runtimeData";

describe("SubscribeLink Tests", () => {
  const sp2LinkPrefix = `${mockedRuntimeData.FXA_ORIGIN}/subscriptions/products`;
  const sp3LinkPrefix =
    "https://payments-next.stage.fxa.nonprod.webservices.mozgcp.net";
  const mockDataPlanID = "price_1JmROfJNcmPzuWtR6od8OfDW";

  const testCases = [
    { billingPeriod: "monthly", planIdPresent: true },
    { billingPeriod: "yearly", planIdPresent: true },
    { billingPeriod: "monthly", planIdPresent: false },
    { billingPeriod: "yearly", planIdPresent: false },
  ] as const;

  testCases.forEach(({ billingPeriod, planIdPresent }) => {
    it(`getPeriodicalPremiumSubscribeLink should return correct link for billingPeriod: ${billingPeriod} (planIdPresent: ${planIdPresent})`, () => {
      // Modify mocked data depending on planIdPresent
      const planId = planIdPresent ? mockDataPlanID : "";
      mockedRuntimeData.PERIODICAL_PREMIUM_PLANS.plan_country_lang_mapping.NL[
        "*"
      ][billingPeriod].id = planId;

      // Generate link
      const link = getPeriodicalPremiumSubscribeLink(
        mockedRuntimeData as RuntimeDataWithPeriodicalPremiumAvailable,
        billingPeriod as keyof PlanData,
      );

      // Expected result
      const expectedLink = planIdPresent
        ? `${sp2LinkPrefix}/${mockedRuntimeData.PERIODICAL_PREMIUM_PRODUCT_ID}?plan=${planId}`
        : `${sp3LinkPrefix}/relay-premium-127/${billingPeriod}/landing`;

      expect(link).toBe(expectedLink);
    });
  });

  testCases.forEach(({ billingPeriod, planIdPresent }) => {
    it(`getPhoneSubscribeLink should return correct link for billingPeriod: ${billingPeriod} (planIdPresent: ${planIdPresent})`, () => {
      // Modify mocked data depending on planIdPresent
      const planId = planIdPresent ? mockDataPlanID : "";
      mockedRuntimeData.PHONE_PLANS.plan_country_lang_mapping.NL["*"][
        billingPeriod
      ].id = planId;

      // Generate link
      const link = getPhoneSubscribeLink(
        mockedRuntimeData as RuntimeDataWithPhonesAvailable,
        billingPeriod as keyof PlanData,
      );

      // Expected result
      const expectedLink = planIdPresent
        ? `${sp2LinkPrefix}/${mockedRuntimeData.PHONE_PRODUCT_ID}?plan=${planId}`
        : `${sp3LinkPrefix}/relay-premium-127-phone/${billingPeriod}/landing`;

      expect(link).toBe(expectedLink);
    });
  });

  [true, false].forEach((planIdPresent) => {
    const billingPeriod = "yearly";
    it(`getBundleSubscribeLink should return correct link for billingPeriod: ${billingPeriod} (planIdPresent: ${planIdPresent})`, () => {
      // Modify mocked data depending on planIdPresent
      const planId = planIdPresent ? mockDataPlanID : "";
      mockedRuntimeData.BUNDLE_PLANS.plan_country_lang_mapping.NL["*"][
        billingPeriod
      ].id = planId;

      // Generate link
      const link = getBundleSubscribeLink(
        mockedRuntimeData as RuntimeDataWithBundleAvailable,
      );

      // Expected result
      const expectedLink = planIdPresent
        ? `${sp2LinkPrefix}/${mockedRuntimeData.BUNDLE_PRODUCT_ID}?plan=${planId}`
        : `${sp3LinkPrefix}/bundle-relay-vpn-dev/${billingPeriod}/landing`;

      expect(link).toBe(expectedLink);
    });
  });
});
