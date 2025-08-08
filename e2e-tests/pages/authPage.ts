import { Locator, Page } from "@playwright/test";
import { forceNonReactLink, TIMEOUTS } from "../e2eTestUtils/helpers";

export class AuthPage {
  readonly page: Page;
  readonly emailInputField: Locator;
  readonly passwordInputField: Locator;
  readonly submitButton: Locator;
  readonly verifyCodeInputField: Locator;
  readonly newPasswordInputFieldSignIn: Locator;
  readonly passwordSignupInputField: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInputField = page.locator('input[name="email"]');
    this.passwordInputField = page.locator('[type="password"]').nth(0);
    this.passwordSignupInputField = page.getByTestId(
      "new-password-input-field",
    );
    this.submitButton = page.locator('[type="submit"]').first();
    this.verifyCodeInputField = page.getByTestId(
      "confirm-signup-code-input-field",
    );
    this.newPasswordInputFieldSignIn = page.locator(
      "input[data-testid='input-field'][name='password'][type='password']",
    );
  }

  async continue() {
    await this.submitButton.click();
  }

  async enterVerificationCode(code: string) {
    await this.page
      .getByText("Enter confirmation code")
      .waitFor({ state: "attached", timeout: TIMEOUTS.LONG });
    await forceNonReactLink(this.page);
    await this.verifyCodeInputField.fill(code);
    await this.submitButton.click();
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
    await this.page
      .locator('[data-testid="input-label"]', { hasText: "Enter your email" })
      .waitFor({ state: "attached", timeout: TIMEOUTS.LONG });
    await this.enterEmail(email);
    await this.page
      .getByText("Enter your password")
      .waitFor({ state: "attached", timeout: TIMEOUTS.LONG });
    await this.enterPassword();
  }

  async signUp(email: string, emailEntered: boolean = false) {
    if (!emailEntered) {
      await this.page
        .locator('[data-testid="input-label"]', { hasText: "Enter your email" })
        .waitFor({ state: "attached", timeout: TIMEOUTS.LONG });
      await this.enterEmail(email);
    }
    await this.page
      .getByTestId("new-password-input-field")
      .waitFor({ state: "attached", timeout: TIMEOUTS.LONG });
    await this.passwordSignupInputField.fill(
      process.env.E2E_TEST_ACCOUNT_PASSWORD as string,
    );
    await this.submitButton.click();
  }
}
