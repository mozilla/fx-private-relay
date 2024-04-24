import test, { expect } from "../fixtures/basePages";
import { checkAuthState, defaultScreenshotOpts } from "../e2eTestUtils/helpers";

// using logged in state outside of describe block will cover state for all tests in file
test.use({ storageState: "state.json" });
test.describe("Free - General Functionalities, Desktop", () => {
  test.beforeEach(async ({ dashboardPage, page }) => {
    await dashboardPage.open();
    await checkAuthState(page);
    await dashboardPage.skipOnboarding();
    await dashboardPage.maybeDeleteMasks();
  });

  test("Check the free user can only create 5 masks, C1553067 @health_check", async ({
    dashboardPage,
    page,
  }) => {
    // Generating five masks takes a while:
    await expect(async () => {
      await dashboardPage.generateMask(5);
      expect((await page.locator(dashboardPage.maskCardString).count()) === 5);
    }).toPass();

    // After five times, user cannot add other masks anymore
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
    page,
  }) => {
    await expect(async () => {
      await dashboardPage.generateMask(1);
      expect((await page.locator(dashboardPage.maskCardString).count()) === 1);
    }).toPass();

    await expect(page.locator(dashboardPage.maskCardString)).toHaveScreenshot(
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

  test("Check that the user can delete an mask, and is prompted to confirm before they delete, C1553071 @health_check", async ({
    dashboardPage,
    page,
  }) => {
    await expect(async () => {
      await dashboardPage.generateMask(1);
      expect((await page.locator(dashboardPage.maskCardString).count()) === 1);
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
