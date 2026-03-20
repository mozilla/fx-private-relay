import test, { expect } from "../fixtures/basePages";
import {
  checkAuthState,
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
