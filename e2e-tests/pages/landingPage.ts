import { Locator, Page } from "@playwright/test";

export class LandingPage {
  readonly page: Page;
  readonly header: Locator;
  readonly FAQButton: Locator;
  readonly homeButton: Locator;
  readonly signUpButton: Locator;
  readonly subscriptionTitle: Locator;
  readonly planMatrixDesktop: Locator;
  readonly planMatrixMobile: Locator;
  yearlyEmailsPlan: Locator;
  monthlyEmailsPlan: Locator;
  emailsPlanSubmit: Locator;
  yearlyEmailsPhonesBundle: Locator;
  monthlyEmailsPhonesBundle: Locator;
  emailsPhonesBundleSubmit: Locator;
  vpnBundleSubmit: Locator;
  readonly signInButton: Locator;
  readonly firefoxAppsServices: Locator;
  readonly firefoxAppsServicesHeading: Locator;
  readonly firefoxLogo: Locator;
  readonly heroSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroSection = page.locator("#hero");
    this.header = page.locator("#overlayProvider header");
    this.FAQButton = page.getByRole("link", { name: "FAQ", exact: true });
    this.homeButton = page.getByRole("link", { name: "Home", exact: true });
    this.signUpButton = page.locator('a:has-text("Sign Up")').first();
    this.planMatrixDesktop = page.locator(
      '//table[starts-with(@class, "PlanMatrix_desktop")]',
    );
    this.planMatrixMobile = page.locator(
      '//div[starts-with(@class, "PlanMatrix_mobile")]',
    );
    this.subscriptionTitle = page.locator(
      '[data-testid="subscription-create-title"]',
    );
    this.signInButton = page.locator('a:has-text("Sign In")');
    this.firefoxAppsServices = page.getByRole("button", {
      name: "Firefox apps and services",
    });
    this.firefoxAppsServicesHeading = page.getByRole("heading", {
      name: "Firefox is tech that fights for your online privacy.",
    });
    this.firefoxLogo = page.locator('//a[starts-with(@class, "Layout_logo")]');
    this.setPlanElements();
  }

  async setPlanElements() {
    const isDesktop = await this.planMatrixDesktop.isVisible();
    const currPlanMatrix = isDesktop
      ? this.planMatrixDesktop
      : this.planMatrixMobile;
    this.yearlyEmailsPlan = currPlanMatrix
      .locator('[id*="tab-yearly"]')
      .first();
    this.monthlyEmailsPlan = currPlanMatrix
      .locator('[id*="tab-monthly"]')
      .first();
    this.emailsPlanSubmit = currPlanMatrix.getByText("Sign Up").first();
    this.yearlyEmailsPhonesBundle = currPlanMatrix
      .locator('[id*="tab-yearly"]')
      .nth(1);
    this.monthlyEmailsPhonesBundle = currPlanMatrix
      .locator('[id*="tab-monthly"]')
      .nth(1);
    this.emailsPhonesBundleSubmit = currPlanMatrix.getByText("Sign Up").nth(1);
    this.vpnBundleSubmit = currPlanMatrix.getByText("Sign Up").nth(2);
  }

  async open() {
    await this.page.goto(process.env.E2E_TEST_BASE_URL as string);
  }

  async goHome() {
    await Promise.all([
      this.page.waitForLoadState("networkidle"),
      this.homeButton.click(),
    ]);
  }

  async goToFAQ() {
    await Promise.all([this.page.waitForURL(/faq/), this.FAQButton.click()]);
  }

  async goToSignUp() {
    await this.signUpButton.click();
  }

  async selectYearlyEmailsPlan() {
    await this.yearlyEmailsPlan.click();
    await this.emailsPlanSubmit.click();
  }

  async selectMonthlyEmailsPlan() {
    await this.monthlyEmailsPlan.click();
    await this.emailsPlanSubmit.click();
  }

  async selectYearlyPhonesEmailsBundle() {
    await this.yearlyEmailsPhonesBundle.click();
    await this.emailsPhonesBundleSubmit.click();
  }

  async selectMonthlyPhonesEmailsBundle() {
    await this.monthlyEmailsPhonesBundle.click();
    await this.emailsPhonesBundleSubmit.click();
  }

  async selectVpnBundlePlan() {
    await this.vpnBundleSubmit.click();
  }

  async goToSignIn() {
    await this.signInButton.click();
    await this.page.waitForURL("**/oauth/**");
  }

  async openFirefoxAppsServices() {
    await this.page.waitForLoadState("networkidle");
    await this.firefoxAppsServices.click({ force: true });
  }

  async clickFirefoxLogo() {
    await this.firefoxLogo.click();
  }
}
