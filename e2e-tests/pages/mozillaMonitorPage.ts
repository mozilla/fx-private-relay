import { Page, Locator } from "@playwright/test";
import { getVerificationCode } from "../e2eTestUtils/helpers";

export class MozillaMonitorPage {
  readonly page: Page;
  readonly monitorSignUpInput: Locator;
  readonly monitorSignUpButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.monitorSignUpInput = page
      .locator("//form[contains(@class, 'SignUpForm_form')]/input")
      .first();
    this.monitorSignUpButton = page
      .locator("button.Button_primary___XZsP")
      .first();
  }

  async signupWithMask(randomMask: string | null) {
    if (randomMask === null) {
      return new Error("Mask could not be created.");
    }

    await this.page.goto("https://monitor.mozilla.org/", {
      waitUntil: "networkidle",
    });
    await this.monitorSignUpInput.fill(randomMask as string);
    await this.monitorSignUpButton.click();
    await this.page.waitForURL("**/oauth/signup**");

    await this.page
      .locator("#password")
      .fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
    await this.page
      .locator("#vpassword")
      .fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
    await this.page.locator("#age").fill("31");
    await this.page.locator("#submit-btn").click();
    await this.page.waitForURL("**/confirm_signup_code**");

    // verification email from fxa to generatedMaskEmail should be forwarded to E2E_TEST_ACCOUNT_FREE
    await getVerificationCode(
      process.env.E2E_TEST_ACCOUNT_FREE as string,
      this.page,
    );
  }
}
