import { Page, Locator } from "@playwright/test";
import {
  forceNonReactLink,
  getVerificationCode,
} from "../e2eTestUtils/helpers";
import { AuthPage } from "./authPage";

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
    const authPage = new AuthPage(this.page);
    await authPage.signUp(randomMask, true);
  }
}
