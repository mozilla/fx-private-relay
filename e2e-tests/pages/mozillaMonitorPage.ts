import { Page, Locator } from "@playwright/test";
import { ENV_MONITOR, TIMEOUTS } from "../e2eTestUtils/helpers";
import { AuthPage } from "./authPage";

export class MozillaMonitorPage {
  readonly page: Page;
  readonly monitorSignUpInput: Locator;
  readonly monitorSignUpButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.monitorSignUpInput = page.locator("input[type='email']").first();
    this.monitorSignUpButton = page
      .getByRole("button", { name: "Get free scan" })
      .first();
  }

  async signupWithMask(randomMask: string | null) {
    if (randomMask === null) {
      return new Error("Mask could not be created.");
    }
    await this.page.goto(ENV_MONITOR[process.env.E2E_TEST_ENV as string], {
      waitUntil: "networkidle",
    });
    await this.monitorSignUpInput.fill(randomMask as string);
    await this.monitorSignUpButton.click();
    await this.page.waitForURL("**/oauth/signup**");
    const authPage = new AuthPage(this.page);
    await authPage.signUp(randomMask, true);
    await this.page
      .getByText("Enter confirmation code")
      .waitFor({ state: "attached", timeout: TIMEOUTS.MEDIUM });
  }
}
