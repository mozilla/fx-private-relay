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
  readonly newPasswordInputFieldSignIn: Locator;
  readonly passwordSignupInputField: Locator;
  readonly passwordSignupConfirmInputField: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInputField = page.locator('input[name="email"]');
    this.passwordInputField = page.locator("#password");
    this.passwordSignupInputField = page.getByTestId(
      "new-password-input-field",
    );
    this.passwordSignupConfirmInputField = page.getByTestId(
      "verify-password-input-field",
    );
    this.ageInputField = page.getByTestId("age-input-field");
    this.continueButton = page.locator("#submit-btn");
    this.createAccountButton = page.getByRole("button", {
      name: "Create account",
    });
    this.verifyCodeInputField = page.getByTestId(
      "confirm-signup-code-input-field",
    );
    this.confirmCodeButton = page.getByRole("button", { name: "Confirm" });
    this.newPasswordInputFieldSignIn = page.locator(
      "input[data-testid='input-field'][name='password'][type='password']",
    );
  }

  async continue() {
    await this.continueButton.click();
  }

  async enterVerificationCode(code: string) {
    await this.page
      .getByText("Enter confirmation code")
      .waitFor({ state: "attached", timeout: 3000 });
    await forceNonReactLink(this.page);
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
    await this.page
      .getByText("Enter your email")
      .waitFor({ state: "attached", timeout: 3000 });
    await this.enterEmail(email);
    await this.page
      .getByText("Enter your password")
      .waitFor({ state: "attached", timeout: 3000 });
    await this.enterPassword();
  }

  async signUp(email: string, emailEntered: boolean = false) {
    if (!emailEntered) {
      await this.page
        .getByText("Enter your email")
        .waitFor({ state: "attached", timeout: 3000 });
      await this.enterEmail(email);
    }
    await this.page
      .getByText("Set your password")
      .waitFor({ state: "attached", timeout: 3000 });
    await this.passwordSignupInputField.fill(
      process.env.E2E_TEST_ACCOUNT_PASSWORD as string,
    );
    await this.passwordSignupConfirmInputField.fill(
      process.env.E2E_TEST_ACCOUNT_PASSWORD as string,
    );
    await this.ageInputField.type("31");
    await this.createAccountButton.click();
  }
}
