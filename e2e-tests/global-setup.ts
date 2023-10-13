import { ENV_URLS, getVerificationCode, setEnvVariables } from "./e2eTestUtils/helpers";
import { AuthPage } from "./pages/authPage";
import { LandingPage } from "./pages/landingPage";

const { chromium } = require('@playwright/test');

async function globalSetup() {
    // playwright setup
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // generate email and set env variables
    const randomEmail = `${Date.now()}_tstact@restmail.net`
    await setEnvVariables(randomEmail)

    await page.goto(ENV_URLS[process.env.E2E_TEST_ENV as string])
    const landingPage = new LandingPage(page);
    await landingPage.goToSignUp()

    // register user with generated email and set as env variable
    const authPage = new AuthPage(page)
    await authPage.signUp(randomEmail)

    // get verification code from restmail
    const verificationCode = await getVerificationCode(randomEmail, page)
    await authPage.enterVerificationCode(verificationCode)

    await page.context().storageState({ path: 'state.json' });
    await browser.close();
}

export default globalSetup;