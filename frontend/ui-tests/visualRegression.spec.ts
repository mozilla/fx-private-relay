import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("The FAQ page", async ({ baseURL, page }) => {
    await page.goto(baseURL + "/faq/", { waitUntil: "networkidle" });
    const faqs = page.locator("main");
    expect(await faqs.screenshot()).toMatchSnapshot("public-faq.png");
  });

  test("The Premium interstitial page", async ({ baseURL, page }) => {
    await page.goto(baseURL + "/premium/", { waitUntil: "networkidle" });
    // The Plan comparison is only loaded after an API request determines
    // that the Plan is available in the user's country. And after *that*,
    // the Relay logos still have to load:
    await page.locator("img[alt='Firefox Relay Premium']").waitFor();
    const content = page.locator("main");
    expect(await content.screenshot()).toMatchSnapshot(
      "public-interstitial.png"
    );
  });
});

test.describe("New account", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // After load, the page will send requests to the API to determine whether the
    // user is logged in, and load the dashboard if they are.
    // Since the API is mocked, we know they are, so we wait until all API
    // requests are done ("networkidle") and therefore the dashboard is loaded:
    await page.goto(baseURL + "?mockId=empty", { waitUntil: "networkidle" });
  });

  test("<Onboarding>", async ({ page }) => {
    const onboarding = page.locator("_react=Onboarding");
    expect(await onboarding.screenshot()).toMatchSnapshot(
      "empty-Onboarding.png"
    );
  });
});

test.describe("Newly-Premium account", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // After load, the page will send requests to the API to determine whether the
    // user is logged in, and load the dashboard if they are.
    // Since the API is mocked, we know they are, so we wait until all API
    // requests are done ("networkidle") and therefore the dashboard is loaded:
    await page.goto(baseURL + "?mockId=onboarding", {
      waitUntil: "networkidle",
    });
  });

  test("<PremiumOnboarding>", async ({ page }) => {
    const premiumOnboarding = page.locator("_react=PremiumOnboarding");
    expect(await premiumOnboarding.screenshot()).toMatchSnapshot(
      "onboarding-PremiumOnboarding.png"
    );
  });
});

test.describe("Fully configured account", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // After load, the page will send requests to the API to determine whether the
    // user is logged in, and load the dashboard if they are.
    // Since the API is mocked, we know they are, so we wait until all API
    // requests are done ("networkidle") and therefore the dashboard is loaded:
    await page.goto(baseURL + "?mockId=full", { waitUntil: "networkidle" });
  });

  test("<ProfileBanners>", async ({ page }) => {
    const profileBanners = page.locator("_react=ProfileBanners");
    expect(await profileBanners.screenshot()).toMatchSnapshot(
      "full-ProfileBanners.png"
    );
  });

  test("<AliasList>", async ({ page }) => {
    const aliasList = page.locator("_react=AliasList");
    expect(await aliasList.screenshot()).toMatchSnapshot("full-AliasList.png");
  });
});
