import {
  ENV_URLS,
  getVerificationCode,
  setEnvVariables,
} from "./e2eTestUtils/helpers";
import { AuthPage } from "./pages/authPage";
import { LandingPage } from "./pages/landingPage";

const { chromium } = require("@playwright/test");

async function globalSetup() {
  // playwright setup
  const browser = await chromium.launch();
  const page = await browser.newPage({
    // Send fxa-ci header to bypass Fastly CAPTCHA on FxA stage
    extraHTTPHeaders: process.env.FXA_CI_SECRET
      ? { "fxa-ci": process.env.FXA_CI_SECRET }
      : {},
  });

  // Strip fxa-ci from api-accounts requests to avoid CORS preflight failures.
  // The fxa-ci custom header triggers a CORS preflight on cross-origin fetch()
  // calls. api-accounts doesn't include fxa-ci in Access-Control-Allow-Headers,
  // so the browser blocks the response. This breaks the OAuth client info fetch
  // and causes "Invalid OAuth parameter: scope" errors.
  if (process.env.FXA_CI_SECRET) {
    await page.route("**/api-accounts*/**", (route: any) => {
      const headers = { ...route.request().headers() };
      delete headers["fxa-ci"];
      return route.continue({ headers });
    });
  }

  // generate email and set env variables
  const randomEmail = `${Date.now()}_tstact@restmail.net`;
  await setEnvVariables(randomEmail);

  await page.goto(ENV_URLS[process.env.E2E_TEST_ENV as string]);
  const landingPage = new LandingPage(page);
  await landingPage.goToSignUp();

  // register user with generated email and set as env variable
  const authPage = new AuthPage(page);
  await authPage.signUp(randomEmail);

  // get verification code from restmail
  const verificationCode = await getVerificationCode(randomEmail, page);
  await authPage.enterVerificationCode(verificationCode);

  await page.context().storageState({ path: "state.json" });
  await browser.close();
}

export default globalSetup;
