import { getVerificationCode } from "./e2eTestUtils/helpers";
import { AuthPage } from "./pages/authPage";
import { LandingPage } from "./pages/landingPage";

const { chromium } = require('@playwright/test');

async function globalSetup() {
    // playwright setup
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const randomEmail = `${Date.now()}_tstact@restmail.net`
    await page.goto(process.env.E2E_TEST_BASE_URL as string)
    const landingPage = new LandingPage(page);
    await landingPage.goToSignUp()

    // register user with generated email and set as env variable
    const authPage = new AuthPage(page)
    await authPage.signUp(randomEmail)

    // get verification code from restmail
    const verificationCode = await getVerificationCode(randomEmail, page)
    await authPage.enterVerificationCode(verificationCode)

    // set env variable
    process.env['E2E_TEST_ACCOUNT_FREE'] = randomEmail;

    await page.context().storageState({ path: 'state.json' });
    await browser.close();
}

export default globalSetup;