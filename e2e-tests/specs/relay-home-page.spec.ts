import test, { expect } from "../fixtures/basePages";

test.describe("Check header buttons and their redirects, C1812638", () => {
  test.beforeEach(async ({ landingPage }) => {
    await landingPage.open();
  });

  test("Verify home FAQ button redirect", async ({ landingPage }) => {
    const FAQRedirectLink = await landingPage.FAQButton.getAttribute("href");
    expect(FAQRedirectLink).toEqual("/faq/");
  });

  test("Verify home button redirect", async ({ landingPage }) => {
    const homeRedirectLink = await landingPage.homeButton.getAttribute("href");
    expect(homeRedirectLink).toEqual("/");
  });

  test("Verify home firefox logo redirect", async ({ landingPage }) => {
    const firefoxLogoRedirectLink =
      await landingPage.firefoxLogo.getAttribute("href");
    expect(firefoxLogoRedirectLink).toEqual("/");
  });

  test("Verify sign in button authentication flow, C1818784", async ({
    landingPage,
    authPage,
  }) => {
    await landingPage.goToSignIn();
    expect(authPage.emailInputField.isVisible()).toBeTruthy();
  });

  test("Verify sign up button authentication flow, C1818782", async ({
    landingPage,
    authPage,
  }) => {
    await landingPage.goToSignUp();
    expect(authPage.emailInputField.isVisible()).toBeTruthy();
  });
});
