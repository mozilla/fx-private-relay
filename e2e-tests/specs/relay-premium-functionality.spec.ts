import test, { expect } from "../fixtures/basePages";
import {
  ENV_URLS,
  fetchMaxNumFreeAliases,
  MAX_NUM_FREE_ALIASES,
} from "../e2eTestUtils/helpers";

let freeMaskLimit = MAX_NUM_FREE_ALIASES;

test.describe("Premium - General Functionalities, Desktop", () => {
  test.beforeAll(async () => {
    const env = process.env.E2E_TEST_ENV ?? "stage";
    const baseUrl = ENV_URLS[env] as string;
    freeMaskLimit = await fetchMaxNumFreeAliases(baseUrl);
  });

  test.beforeEach(async ({ landingPage, authPage, dashboardPage }) => {
    await landingPage.open();
    await landingPage.goToSignIn();
    await authPage.login(process.env.E2E_TEST_ACCOUNT_PREMIUM as string);
    // Pre-seed to freeMaskLimit via API so tests start with masks already present.
    // This avoids creating all masks via UI and keeps the account out of onboarding mode.
    await dashboardPage.maybeDeleteMasks(freeMaskLimit);
  });

  test(`Verify that a premium user can make more than ${MAX_NUM_FREE_ALIASES} masks`, async ({
    dashboardPage,
  }) => {
    // beforeEach leaves exactly freeMaskLimit masks; create one more via UI to
    // verify the premium account can exceed the free limit.
    await dashboardPage.generateMask(1, true);

    await expect
      .poll(
        async () => {
          return await dashboardPage.emailMasksUsedAmount.textContent();
        },
        {
          intervals: [1_000],
        },
      )
      .toContain(String(freeMaskLimit + 1));
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

  test("Verify that a premium user can generate a custom mask", async ({
    dashboardPage,
  }) => {
    // When there are zero masks, a random mask must be generated first.
    // Use isPremium=true so the premium button is clicked, not the free one.
    await dashboardPage.generateMask(1, true);
    await dashboardPage.generatePremiumDomainMask();
  });
});
