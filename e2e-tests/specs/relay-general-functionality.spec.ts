import test, { expect } from "../fixtures/basePages";
import {
  checkAuthState,
  defaultScreenshotOpts,
  ENV_URLS,
  fetchMaxNumFreeAliases,
  MAX_NUM_FREE_ALIASES,
} from "../e2eTestUtils/helpers";

// using logged in state outside of describe block will cover state for all tests in file
test.use({ storageState: "state.json" });

let freeMaskLimit = MAX_NUM_FREE_ALIASES;

test.describe("Free - General Functionalities, Desktop", () => {
  test.beforeAll(async () => {
    const env = process.env.E2E_TEST_ENV ?? "stage";
    const baseUrl = ENV_URLS[env] as string;
    freeMaskLimit = await fetchMaxNumFreeAliases(baseUrl);
  });

  test.beforeEach(async ({ dashboardPage, page }) => {
    await dashboardPage.open();
    await checkAuthState(page);
    await dashboardPage.skipOnboarding();
    // Leave freeMaskLimit - 1 masks so the test only needs to create one more.
    await dashboardPage.maybeDeleteMasks(freeMaskLimit - 1);
  });

  test(`Check the free user can only create ${MAX_NUM_FREE_ALIASES} masks, C1553067`, async ({
    dashboardPage,
  }) => {
    // beforeEach leaves freeMaskLimit - 1 masks; create the final one via UI
    // to verify the limit is enforced.
    await dashboardPage.generateMask(1);

    // After reaching the limit, user cannot add other masks anymore
    expect(await dashboardPage.maxMaskLimitButton.textContent()).toContain(
      "Get unlimited email masks",
    );
    expect(await dashboardPage.maxMaskBannerText.innerText()).toContain(
      "mask limit",
    );
  });
});

test.describe("Free - General Functionalities, Desktop - Visual Regression", () => {
  test.skip(
    ({ browserName }) => browserName !== "firefox",
    "firefox only image comparisons!",
  );

  test.beforeEach(async ({ dashboardPage, page }) => {
    await dashboardPage.open();
    await checkAuthState(page);
    await dashboardPage.skipOnboarding();
    await dashboardPage.maybeDeleteMasks();
  });

  test("Verify that the Header is displayed correctly for a Free user that is logged in, C1812639", async ({
    dashboardPage,
  }) => {
    await expect(dashboardPage.header).toHaveScreenshot(
      `${process.env.E2E_TEST_ENV}-dashboardHeader.png`,
      { ...defaultScreenshotOpts },
    );
  });

  test("Verify that the extension upgrade banner is shown, C1812641", async ({
    dashboardPage,
  }) => {
    await dashboardPage.relayExtensionBanner.scrollIntoViewIfNeeded();
    await expect(dashboardPage.relayExtensionBanner).toHaveScreenshot(
      `${process.env.E2E_TEST_ENV}-relayExtensionBanner.png`,
      defaultScreenshotOpts,
    );
  });

  test("Verify that opened mask cards are displayed correctly to a Free user, C1553070", async ({
    dashboardPage,
  }) => {
    await expect(async () => {
      await dashboardPage.generateMask(1);
      expect((await dashboardPage.maskCards.count()) === 1);
    }).toPass();

    await expect(dashboardPage.maskCards).toHaveScreenshot(
      `${process.env.E2E_TEST_ENV}-maskCard.png`,
      {
        ...defaultScreenshotOpts,
        mask: [
          dashboardPage.maskCardGeneratedEmail,
          dashboardPage.maskCardBottomMeta,
        ],
      },
    );
  });

  test("Check that the user can delete an mask, and is prompted to confirm before they delete, C1553071", async ({
    dashboardPage,
  }) => {
    await expect(async () => {
      await dashboardPage.generateMask(1);
      expect((await dashboardPage.maskCards.count()) === 1);
      await dashboardPage.maskCardDeleteButton.click();
    }).toPass();

    await expect(dashboardPage.maskCardDeleteDialogModal).toHaveScreenshot(
      `${process.env.E2E_TEST_ENV}-maskCardDeleteDialogModal.png`,
      {
        ...defaultScreenshotOpts,
        mask: [dashboardPage.maskCardDeleteDialogModalGeneratedEmail],
      },
    );
  });
});
