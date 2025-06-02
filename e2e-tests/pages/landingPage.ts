import { Locator, Page } from "@playwright/test";

export class LandingPage {
  readonly page: Page;
  readonly header: Locator;
  readonly FAQButton: Locator;
  readonly homeButton: Locator;
  readonly signUpButton: Locator;
  readonly subscriptionTitle: Locator;
  readonly planGrid: Locator;
  yearlyPremiumTab: Locator;
  monthlyPremiumTab: Locator;
  yearlyPhoneTab: Locator;
  monthlyPhoneTab: Locator;
  yearlyPremiumSubmit: Locator;
  monthlyPremiumSubmit: Locator;
  yearlyPhoneSubmit: Locator;
  monthlyPhoneSubmit: Locator;
  megabundleSubmit: Locator;
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
    this.planGrid = page.locator('[data-testid="plan-grid-megabundle"]');
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
    // PlanGrid has 3 plans with pricing toggles: premium, phone, megabundle
    // Tabs and submit buttons are ordered from bottom-up in markup
    this.yearlyPremiumTab = this.planGrid.locator('[id*="tab-yearly"]').last();
    this.monthlyPremiumTab = this.planGrid
      .locator('[id*="tab-monthly"]')
      .last();
    this.yearlyPhoneTab = this.planGrid.locator('[id*="tab-yearly"]').first();
    this.monthlyPhoneTab = this.planGrid.locator('[id*="tab-monthly"]').first();

    this.yearlyPremiumSubmit = this.planGrid.getByTestId(
      "plan-cta-premium-yearly",
    );
    this.monthlyPremiumSubmit = this.planGrid.getByTestId(
      "plan-cta-premium-monthly",
    );
    this.yearlyPhoneSubmit = this.planGrid.getByTestId(
      "plan-cta-phones-yearly",
    );
    this.monthlyPhoneSubmit = this.planGrid.getByTestId(
      "plan-cta-phones-monthly",
    );
    this.megabundleSubmit = this.planGrid.getByTestId("plan-cta-megabundle");
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

  async selectYearlyPremiumPlan() {
    await this.yearlyPremiumTab.click();
    await this.yearlyPremiumSubmit.click();
  }

  async selectMonthlyPremiumPlan() {
    await this.monthlyPremiumTab.click();
    await this.monthlyPremiumSubmit.click();
  }

  async selectYearlyPhonesBundle() {
    await this.yearlyPhoneTab.click();
    await this.yearlyPhoneSubmit.click();
  }

  async selectMonthlyPhonesBundle() {
    await this.monthlyPhoneTab.click();
    await this.monthlyPhoneSubmit.click();
  }

  async selectMegabundlePlan() {
    await this.megabundleSubmit.click();
  }

  async goToSignIn() {
    await this.signInButton.click();
    await this.page.waitForURL("**/oauth**");
  }

  async openFirefoxAppsServices() {
    await this.page.waitForLoadState("networkidle");
    await this.firefoxAppsServices.click({ force: true });
  }

  async clickFirefoxLogo() {
    await this.firefoxLogo.click();
  }
}
