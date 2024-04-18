import test, { expect } from "../fixtures/basePages";
import { checkAuthState } from "../e2eTestUtils/helpers";

test.describe.configure({ mode: "parallel" });
test.describe("FxA auth, random mask generation, and email forwarding @health_check", () => {
  test.skip(
    process.env.E2E_TEST_ENV === "prod",
    "This test only works on stage/dev environments",
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

test.describe("Subscription flows @health_check", () => {
  /**
   * Verifies that all plans correctly redirect to its corresponding subscriptions page.
   */

  test.beforeEach(async ({ landingPage }) => {
    await landingPage.open();
  });

  test('Verify that the yearly emails plan "Sign Up" button works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectYearlyEmailsPlan();
    const expectedPlanDetails =
      process.env["E2E_TEST_ENV"] === "prod"
        ? "Relay Premium"
        : "Relay Premium (stage)";

    // verify redirect to subscription page
    expect(await subscriptionPage.subscriptionTitle.textContent()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.planDetails.textContent()).toEqual(
      expectedPlanDetails,
    );
    expect(await subscriptionPage.planType.textContent()).toContain("yearly");
  });

  test('Verify that the monthly emails plan "Sign Up" button works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectMonthlyEmailsPlan();
    const expectedPlanDetails =
      process.env["E2E_TEST_ENV"] === "prod"
        ? "Relay Premium"
        : "Relay Premium (stage)";

    // verify redirect to subscription page
    expect(await subscriptionPage.subscriptionTitle.textContent()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.planDetails.textContent()).toEqual(
      expectedPlanDetails,
    );
    expect(await subscriptionPage.planType.textContent()).toContain("monthly");
  });

  test('Verify that the yearly emails and phones bundle plan "Sign Up" button works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectYearlyPhonesEmailsBundle();
    const expectedPlanDetails =
      process.env["E2E_TEST_ENV"] === "prod"
        ? "Relay Premium: Phone Number & Email Address Masking"
        : "Relay Email & Phone Protection (stage)";

    // verify redirect to subscription page
    expect(await subscriptionPage.subscriptionTitle.textContent()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.planDetails.textContent()).toEqual(
      expectedPlanDetails,
    );
    expect(await subscriptionPage.planType.textContent()).toContain("yearly");
  });

  test('Verify that the monthly emails and phones bundle plan "Sign Up" button works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectMonthlyPhonesEmailsBundle();
    const expectedPlanDetails =
      process.env["E2E_TEST_ENV"] === "prod"
        ? "Relay Premium: Phone Number & Email Address Masking"
        : "Relay Email & Phone Protection (stage)";

    // verify redirect to subscription page
    expect(await subscriptionPage.subscriptionTitle.textContent()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.planDetails.textContent()).toEqual(
      expectedPlanDetails,
    );
    expect(await subscriptionPage.planType.textContent()).toContain("monthly");
  });

  test('Verify that the VPN bundle "Sign Up" button works correctly, C1818792', async ({
    landingPage,
    subscriptionPage,
  }) => {
    await landingPage.selectVpnBundlePlan();
    const expectedPlanDetails =
      process.env["E2E_TEST_ENV"] === "prod"
        ? "Mozilla VPN & Firefox Relay"
        : "Firefox Relay & Mozilla VPN (Stage)";

    // verify redirect to subscription page
    expect(await subscriptionPage.subscriptionTitle.textContent()).toContain(
      "Set up your subscription",
    );
    expect(await subscriptionPage.planDetails.textContent()).toEqual(
      expectedPlanDetails,
    );
    expect(await subscriptionPage.planType.textContent()).toContain("yearly");
  });
});
