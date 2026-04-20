import { ENV_URLS, setEnvVariables } from "./e2eTestUtils/helpers";
import { AuthPage } from "./pages/authPage";
import { LandingPage } from "./pages/landingPage";

const { chromium } = require("@playwright/test");

async function globalSetup() {
  // playwright setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Use existing test account instead of creating a new one
  const testEmail = process.env.E2E_TEST_ACCOUNT_FREE as string;

  if (!testEmail) {
    throw new Error("E2E_TEST_ACCOUNT_FREE environment variable is required");
  }

  if (!process.env.E2E_TEST_ACCOUNT_PASSWORD) {
    throw new Error(
      "E2E_TEST_ACCOUNT_PASSWORD environment variable is required",
    );
  }

  await setEnvVariables(testEmail);

  await page.goto(ENV_URLS[process.env.E2E_TEST_ENV as string]);
  const landingPage = new LandingPage(page);
  await landingPage.goToSignIn();

  // Log in with existing test account (no verification needed)
  const authPage = new AuthPage(page);
  await authPage.login(testEmail);

  await page.context().storageState({ path: "state.json" });
  await browser.close();
}

export default globalSetup;
