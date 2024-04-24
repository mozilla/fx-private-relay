import test, { expect } from "../fixtures/basePages";
import { checkAuthState, defaultScreenshotOpts } from "../e2eTestUtils/helpers";

// using logged in state outside of describe block will cover state for all tests in file
test.use({ storageState: "state.json" });
test.describe.configure({ mode: "parallel" });
test.describe("Premium Relay - Purchase Premium Flow, Desktop", () => {
  test.beforeEach(async ({ dashboardPage, page }) => {
    await dashboardPage.open();
    await checkAuthState(page);
  });

  test('Verify that the "Upgrade" button redirects correctly,  C1812640, 1808503', async ({
    dashboardPage,
    page,
  }) => {
    await dashboardPage.upgrade();
    expect(page.url()).toContain("/premium/");
  });
});

test.describe("Premium Relay - Purchase Premium Flow, Desktop - Visual Regression", () => {
  test.beforeEach(async ({ dashboardPage, page }) => {
    await dashboardPage.open();
    await checkAuthState(page);
    await dashboardPage.skipOnboarding();
  });

  test("Verify that the subscription page is displayed correctly, C1553108", async ({
    dashboardPage,
    page,
  }) => {
    await dashboardPage.upgradeNow();
    expect(page.url()).toContain("premium");
  });
});
