import { Locator, Page } from "@playwright/test";
import { forceNonReactLink } from "../e2eTestUtils/helpers";

export class AuthPage {
  readonly page: Page;
  readonly emailInputField: Locator;
  readonly passwordInputField: Locator;
  readonly passwordConfirmInputField: Locator;
  readonly ageInputField: Locator;
  readonly continueButton: Locator;
  readonly createAccountButton: Locator;
  readonly verifyCodeInputField: Locator;
  readonly confirmCodeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInputField = page.locator('input[name="email"]');
    this.passwordInputField = page.locator("#password");
    this.passwordConfirmInputField = page.locator("#vpassword");
    this.ageInputField = page.locator("#age");
    this.continueButton = page.locator("#submit-btn");
    this.createAccountButton = page.getByRole("button", {
      name: "Create account",
    });
    this.verifyCodeInputField = page.locator("div.card input");
    this.confirmCodeButton = page.getByRole("button", { name: "Confirm" });
  }

  async continue() {
    await this.continueButton.click();
  }

  async enterVerificationCode(code: string) {
    await this.verifyCodeInputField.fill(code);
    await this.confirmCodeButton.click();
  }

  async enterEmail(email: string) {
    await forceNonReactLink(this.page);
    await this.emailInputField.fill(email);
    await this.continue();
  }

  async enterPassword() {
    await forceNonReactLink(this.page);
    await this.passwordInputField.fill(
      process.env.E2E_TEST_ACCOUNT_PASSWORD as string,
    );
    await this.continue();
  }

  async login(email: string) {
    await forceNonReactLink(this.page);
    await this.enterEmail(email);
    await this.enterPassword();
  }

  async signUp(email: string) {
    await forceNonReactLink(this.page);
    await this.enterEmail(email);
    await this.passwordInputField.fill(
      process.env.E2E_TEST_ACCOUNT_PASSWORD as string,
    );
    await this.passwordConfirmInputField.fill(
      process.env.E2E_TEST_ACCOUNT_PASSWORD as string,
    );
    await this.ageInputField.type("31");
    await this.createAccountButton.click();
  }
}
