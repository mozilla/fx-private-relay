import { APIRequestContext, Page, request } from '@playwright/test';

export const ENV_DOMAINS = {
  stage: '@mozmail.fxprivaterelay.nonprod.cloudops.mozgcp.net',
  prod: '@mozmail.com',
  dev: '@mozmail.dev.fxprivaterelay.nonprod.cloudops.mozgcp.net'
}

export const ENV_URLS = {
  stage: 'https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net',
  prod: 'https://relay.firefox.com',
  dev: 'https://dev.fxprivaterelay.nonprod.cloudops.mozgcp.net'
}

export const getVerificationCode = async (testEmail: string, page: Page, attempts = 10) => {
  if (attempts === 0) {
    throw new Error('Unable to retrieve restmail data');
  }

  const context = await request.newContext();  
  const res = await context.get(
    `http://restmail.net/mail/${testEmail}`,
    {
      failOnStatusCode: false
    }
  );
  const resJson = await res.json(); 
  if (resJson.length) {
    const verificationCode = resJson[0].headers['x-verify-short-code']
    return verificationCode;
  }

  await page.waitForTimeout(1000);
  return getVerificationCode(testEmail, page, attempts - 1);
}

export const deleteEmailAddressMessages = async (req: APIRequestContext, testEmail: string) => {
  try {
    await req.delete(`http://restmail.net/mail/${testEmail}`);
  } catch (err) {
    console.error('ERROR DELETE RESTMAIL EMAIL', err);
  }
};

const setYourPassword = async (page: Page) => {  
  await page.locator('#password').fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string)
  await page.locator('#vpassword').fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string)
  await page.locator('#age').fill('31');
  await page.locator('button:has-text("Create account")').click({force: true})
  await page.waitForTimeout(500)
  await checkAuthState(page)  
}

const enterConfirmationCode = async (page: Page) => {        
  const maybeVerificationCodeInput = 'div.card input'
  await page.waitForSelector(maybeVerificationCodeInput, { timeout: 2000 })
  const confirmButton = page.locator('#submit-btn')
  const verificationCode = await getVerificationCode(process.env.E2E_TEST_ACCOUNT_FREE as string, page)
  await page.locator(maybeVerificationCodeInput).fill(verificationCode)
  await confirmButton.click({force: true})
  await page.waitForTimeout(500)
  await checkAuthState(page)
}

const signIn = async (page: Page) => {
  const signInButton = '//*[@id="use-logged-in"]'
  await page.waitForSelector(signInButton, { timeout: 2000 })
  await page.locator(signInButton).click({force: true})
  await page.waitForTimeout(500)
  await checkAuthState(page)
}

const enterYourEmail = async (page: Page) => {
  const maybeEmailInput = 'input[name="email"]'
  await page.waitForSelector(maybeEmailInput, { timeout: 2000 })
  const signInButton = page.locator('#submit-btn')
  await page.locator(maybeEmailInput).fill(process.env.E2E_TEST_ACCOUNT_FREE as string)
  await signInButton.click({force: true})
  await page.waitForTimeout(500)
  await checkAuthState(page)
}

const enterYourPassword = async (page: Page) => {
  await page.locator('#password').fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string)

  // using force here due to fxa issue with playwright
  await page.locator('#submit-btn').click()
  await page.waitForTimeout(500)
  await checkAuthState(page)
}

export const generateRandomEmail = async () => {  
  return `${Date.now()}_tstact@restmail.net`;
};

export const setEnvVariables = async (email: string) => {  
  // set env variables
  // stage will currently be the default
  process.env['E2E_TEST_ACCOUNT_FREE'] = email;
  process.env['E2E_TEST_BASE_URL'] = ENV_URLS[process.env.E2E_TEST_ENV as string] || 'https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net'
  process.env['E2E_TEST_ENV'] = process.env.E2E_TEST_ENV || 'stage'
}

interface DefaultScreenshotOpts {
  animations?: "disabled" | "allow" | undefined
  maxDiffPixelRatio?: number | undefined;
}

export const defaultScreenshotOpts: Partial<DefaultScreenshotOpts> = {
  animations: 'disabled',
  maxDiffPixelRatio: 0.04
};

export const checkAuthState = async (page: Page) => {
  try {    
    const authStateTitleString = await page.locator('h1').textContent({ timeout: 2000 }) 
    const checkIfTitleConatins = (potentialTitle: string) => {
      return authStateTitleString?.includes(potentialTitle)
    }

    switch (true) {
      case checkIfTitleConatins('Enter your email'):
        await enterYourEmail(page)
        break;
      case checkIfTitleConatins('Enter your password'):
        await enterYourPassword(page)
        break;
      case checkIfTitleConatins('Set your password'):
        await setYourPassword(page)
        break;
      case checkIfTitleConatins('Enter confirmation code'):
        await enterConfirmationCode(page)
        break;
      case checkIfTitleConatins('Sign in'):
        await signIn(page)
        break;
      default:
        break;
    }
  } catch {}
}