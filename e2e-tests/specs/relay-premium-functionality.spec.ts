import test, { expect } from "../fixtures/basePages";

test.describe("Premium - General Functionalities, Desktop", () => {
  test.beforeEach(async ({ landingPage, authPage, dashboardPage }) => {
    await landingPage.open();
    await landingPage.goToSignIn();
    await authPage.login(process.env.E2E_TEST_ACCOUNT_PREMIUM as string);
    const totalMasks = await dashboardPage.emailMasksUsedAmount.textContent();
    await dashboardPage.maybeDeleteMasks(true, parseInt(totalMasks as string));
  });

  test("Verify that a premium user can make more than 5 masks @health_check", async ({
    dashboardPage,
  }) => {
    await dashboardPage.generateMask(6, true);

    await expect
      .poll(
        async () => {
          return await dashboardPage.emailMasksUsedAmount.textContent();
        },
        {
          intervals: [1_000],
        },
      )
      .toContain("6");
  });

  test("Verify that a user can click the mask blocking options", async ({
    dashboardPage,
  }) => {
    await dashboardPage.generateMask(1, true);
    await dashboardPage.blockPromotions.click();
    expect(await dashboardPage.blockLevelPromosLabel.textContent()).toContain(
      "Blocking promo emails",
    );
    await dashboardPage.blockAll.click();
    expect(await dashboardPage.blockLevelAllLabel.textContent()).toContain(
      "Blocking all emails",
    );
  });

  test("Verify that a premium user can generate a custom mask @health_check", async ({
    dashboardPage,
  }) => {
    // When there are zero masks, a random mask must be generated first
    await dashboardPage.generateMask();
    await dashboardPage.generatePremiumDomainMask();
  });
});
