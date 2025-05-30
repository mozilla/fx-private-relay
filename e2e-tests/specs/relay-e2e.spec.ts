import test, { expect } from "../fixtures/basePages";
import { checkAuthState } from "../e2eTestUtils/helpers";

test.describe.configure({ mode: "parallel" });
test.describe("FxA auth, random mask generation, and email forwarding @health_check", () => {
  test.skip(
    process.env.E2E_TEST_ENV === "prod",
    "This test only works on stage/dev environments because you cannot use masks to sign up for monitor, see 'Email forwarding and trackers removal' for a similar test",
  );
  // use stored authenticated state
  test.use({ storageState: "state.json" });

  test.beforeEach(async ({ dashboardPage, mozillaMonitorPage }) => {
    const randomMask = await dashboardPage.generateOneRandomMask();
    await mozillaMonitorPage.signupWithMask(randomMask);
  });

  test("Check that the user can use the masks on websites and receive emails sent to the masks, C1553068, C1553065, C1811801", async ({
    dashboardPage,
    page,
  }) => {
    // This tests creates a new Mozilla Account with a new mask, to have
    // the signup confirmation email show up in the forwarded email count.
    // This is a pretty slow process:

    await expect(async () => {
      await dashboardPage.open();
      await checkAuthState(page);
      await dashboardPage.skipOnboarding();
      const forwardedEmailCount =
        await dashboardPage.checkForwardedEmailCount();

      expect(forwardedEmailCount).toEqual("1");
    }).toPass();
  });
});

test.describe("Email forwarding and trackers removal", () => {
  test.skip(
    ({ browserName }) => browserName !== "firefox",
    "firefox only test",
  );
  test.use({ storageState: "state.json" });
  let initialTrackersCount;

  test.beforeEach(async ({ dashboardPage }) => {
    const randomMask = await dashboardPage.generateOneRandomMask();
    initialTrackersCount =
      await dashboardPage.maskCardTrackersCount.textContent();
    // Set trackers removed option
    await dashboardPage.setTrackersRemovalOpt();
    try {
      await dashboardPage.signUpForPageWithTrackers(randomMask as string);
    } catch (e) {
      test.skip(true, e.message);
    }
  });

  test("Verify that an email with trackers is forwarded, and trackers are detected", async ({
    dashboardPage,
  }) => {
    const newTrackersCount = await dashboardPage.checkTrackersCount();
    expect(parseInt(newTrackersCount)).toBeGreaterThan(
      parseInt(initialTrackersCount),
    );
  });
});

test.describe("Subscription flows with PlanGrid @health_check", () => {
  /**
   * Verifies that all plans correctly redirect to their corresponding subscriptions page.
   */
  let expectedPremiumPlanDetails;
  let expectedPhonesPlanDetails;
  let expectedMegabundleDetails;

  test.beforeEach(async ({ landingPage }) => {
    if (process.env["E2E_TEST_ENV"] === "prod") {
      expectedPremiumPlanDetails = "Relay Premium";
      expectedPhonesPlanDetails =
        "Relay Premium: Phone Number & Email Address Masking";
      expectedMegabundleDetails = "Privacy protection plan";
    } else if (process.env["E2E_TEST_ENV"] === "stage") {
      expectedPremiumPlanDetails = "Relay Premium (stage)";
      expectedPhonesPlanDetails = "Relay Email & Phone Protection (stage)";
      expectedMegabundleDetails = "Privacy protection plan";
    } else {
      expectedPhonesPlanDetails = "Relay Email & Phone Protection (dev)";
      expectedMegabundleDetails = "Privacy protection plan";
    }

    await landingPage.open();
  });

  test('Verify that the yearly "Relay Premium" plan works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    test.skip(
      process.env.E2E_TEST_ENV === "dev",
      "Invalid flow in the dev environment.",
    );
    await landingPage.selectYearlyPremiumPlan();
    expect(await subscriptionPage.getSubscriptionTitleText()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.getPlanDetailsText()).toEqual(
      expectedPremiumPlanDetails,
    );
    expect(await subscriptionPage.getPriceDetailsText()).toContain("yearly");
  });

  test('Verify that the monthly "Relay Premium" plan works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    test.skip(
      process.env.E2E_TEST_ENV === "dev",
      "Invalid flow in the dev environment.",
    );
    await landingPage.selectMonthlyPremiumPlan();
    expect(await subscriptionPage.getSubscriptionTitleText()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.getPlanDetailsText()).toEqual(
      expectedPremiumPlanDetails,
    );
    expect(await subscriptionPage.getPriceDetailsText()).toContain("monthly");
  });

  test('Verify that the yearly "Relay + Phone" bundle plan works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectYearlyPhonesBundle();
    expect(await subscriptionPage.getSubscriptionTitleText()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.getPlanDetailsText()).toEqual(
      expectedPhonesPlanDetails,
    );
    expect(await subscriptionPage.getPriceDetailsText()).toContain("yearly");
  });

  test('Verify that the monthly "Relay + Phone" bundle plan works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectMonthlyPhonesBundle();
    expect(await subscriptionPage.getSubscriptionTitleText()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.getPlanDetailsText()).toEqual(
      expectedPhonesPlanDetails,
    );
    expect(await subscriptionPage.getPriceDetailsText()).toContain("monthly");
  });

  test('Verify that the "Megabundle" plan works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectMegabundlePlan();
    expect(await subscriptionPage.getSubscriptionTitleText()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.getPlanDetailsText()).toEqual(
      expectedMegabundleDetails,
    );
    expect(await subscriptionPage.getPriceDetailsText()).toContain("yearly");
  });
});
