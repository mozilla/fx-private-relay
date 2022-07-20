import { AuthPage } from "./pages/authPage";
import { LandingPage } from "./pages/landingPage";

const { chromium } = require('@playwright/test');

async function globalSetup() {
    console.log('Setting a logged in state...')
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const landingPage = new LandingPage(page);
    await page.goto(process.env.TEST_BASE_URL)
    await landingPage.goToSignIn();

    const authPage = new AuthPage(page);
    await authPage.login(
      process.env.TEST_ACCOUNT3_FREE as string,
      process.env.TEST_ACCOUNT_PASSWORD as string
    );

    await page.context().storageState({ path: 'state.json' });
    await browser.close();
}

export default globalSetup;