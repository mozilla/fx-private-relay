import { APIRequestContext, Page, request } from "@playwright/test";

export const ENV_EMAIL_DOMAINS = {
  stage: "@mozmail.fxprivaterelay.nonprod.cloudops.mozgcp.net",
  prod: "@mozmail.com",
  dev: "@mozmail.dev.fxprivaterelay.nonprod.cloudops.mozgcp.net",
  local: "@mozmail.com",
};

export const ENV_URLS = {
  stage: "https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net",
  prod: "https://relay.firefox.com",
  dev: "https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net",
  local: process.env.SITE_ORIGIN,
};

export const getVerificationCode = async (
  testEmail: string,
  page: Page,
  attempts = 10,
) => {
  if (attempts === 0) {
    throw new Error("Unable to retrieve restmail data");
  }

  const context = await request.newContext();
  const res = await context.get(`http://restmail.net/mail/${testEmail}`, {
    failOnStatusCode: false,
  });
  const resJson = await res.json();
  if (resJson.length) {
    const verificationCode = resJson[0].headers["x-verify-short-code"];
    return verificationCode;
  }

  await page.waitForTimeout(2000);
  return getVerificationCode(testEmail, page, attempts - 1);
};

export const deleteEmailAddressMessages = async (
  req: APIRequestContext,
  testEmail: string,
) => {
  try {
    await req.delete(`http://restmail.net/mail/${testEmail}`);
  } catch (err) {
    console.error("ERROR DELETE RESTMAIL EMAIL", err);
  }
};

const setYourPassword = async (page: Page) => {
  await page
    .locator("#password")
    .fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
  await page
    .locator("#vpassword")
    .fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
  await page.locator("#age").fill("31");
  await page
    .locator('button:has-text("Create account")')
    .click({ force: true });
  await page.waitForTimeout(2000);
  await checkAuthState(page);
};

const enterConfirmationCode = async (page: Page) => {
  const maybeVerificationCodeInput = "div.card input";
  await page.waitForSelector(maybeVerificationCodeInput, { timeout: 2000 });
  const confirmButton = page.locator("#submit-btn");
  const verificationCode = await getVerificationCode(
    process.env.E2E_TEST_ACCOUNT_FREE as string,
    page,
  );
  await page.locator(maybeVerificationCodeInput).fill(verificationCode);
  await confirmButton.click({ force: true });
  await page.waitForTimeout(2000);
  await checkAuthState(page);
};

const signIn = async (page: Page) => {
  const signInButton = page.getByRole("button", { name: "Sign in" });
  await signInButton.waitFor({ timeout: 2000 });
  await page.waitForLoadState("networkidle");
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Sign in" }).click({ force: true });
  await page.waitForTimeout(2000);
  await checkAuthState(page);
};

const enterYourEmail = async (page: Page) => {
  const maybeEmailInput = 'input[name="email"]';
  await page.waitForSelector(maybeEmailInput, { timeout: 2000 });
  const signInButton = page.locator("#submit-btn");
  await page
    .locator(maybeEmailInput)
    .fill(process.env.E2E_TEST_ACCOUNT_FREE as string);
  await signInButton.click({ force: true });
  await page.waitForTimeout(500);
  await checkAuthState(page);
};

const enterYourPassword = async (page: Page) => {
  await page
    .locator("#password")
    .fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);

  // using force here due to fxa issue with playwright
  await page.locator("#submit-btn").click();
  await page.waitForTimeout(500);
  await checkAuthState(page);
};

export const generateRandomEmail = async () => {
  return `${Date.now()}_tstact@restmail.net`;
};

export const setEnvVariables = async (email: string) => {
  // set env variables
  // stage will currently be the default
  process.env["E2E_TEST_ENV"] = (process.env.E2E_TEST_ENV as string) ?? "stage";
  process.env["E2E_TEST_ACCOUNT_FREE"] = email;
  process.env["E2E_TEST_BASE_URL"] =
    ENV_URLS[process.env.E2E_TEST_ENV as string] ?? ENV_URLS.stage;
};

interface DefaultScreenshotOpts {
  animations?: "disabled" | "allow" | undefined;
  maxDiffPixelRatio?: number | undefined;
}

export const defaultScreenshotOpts: Partial<DefaultScreenshotOpts> = {
  animations: "disabled",
  maxDiffPixelRatio: 0.04,
};

export const forceNonReactLink = async (page: Page) => {
  /**
   * There is a small chance you are redirected to an FxA auth page with the parameter showReactApp=true.
   * This causes the page to look different, and our selectors for the auth page to become flaky because id's are missing.
   */
  const url = new URL(page.url());
  if (url.searchParams.get('showReactApp') === 'true') { 
    url.searchParams.set('showReactApp', 'false');
    await page.goto(url.toString());
  }
}

export const checkAuthState = async (page: Page) => {
  try {
    await page.waitForLoadState("networkidle");
    await page.waitForLoadState("domcontentloaded");

    const authStateTitleString = await page
      .locator("h1")
      .first()
      ?.textContent({ timeout: 5000 });

    const checkIfTitleContains = (potentialTitle: string) => {
      return authStateTitleString?.includes(potentialTitle);
    };

    await forceNonReactLink(page);

    switch (true) {
      case checkIfTitleContains("Enter your email"):
        await enterYourEmail(page);
        break;
      case checkIfTitleContains("Enter your password"):
        await enterYourPassword(page);
        break;
      case checkIfTitleContains("Set your password"):
        await setYourPassword(page);
        break;
      case checkIfTitleContains("Enter confirmation code"):
        await enterConfirmationCode(page);
        break;
      case checkIfTitleContains("Sign in"):
        await signIn(page);
        break;
      default:
        break;
    }
  } catch {}
};
