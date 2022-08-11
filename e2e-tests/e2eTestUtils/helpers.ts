import { APIRequestContext, Page, request } from '@playwright/test';

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

export const checkForSignInButton = async (page: Page) => {
  try {    
    const maybeSignInButton = 'button:has-text("Sign In")'
    await page.waitForSelector(maybeSignInButton, { timeout: 2000 })
    await page.locator(maybeSignInButton).click()
  } catch (error) {
    console.error('Proceeded to logged in page')
  }
}

export const checkForEmailInput = async (page: Page) => {
  try {    
    const maybeEmailInput = '.email'
    await page.waitForSelector(maybeEmailInput, { timeout: 2000 })
    const signInButton = page.locator('button:has-text("Sign up or sign in")')
    await page.locator(maybeEmailInput).fill(process.env.E2E_TEST_ACCOUNT_FREE as string)
    await signInButton.click()
    await page.locator('#password').fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string)
    await page.locator('#submit-btn').click()
  } catch (error) {
    console.error('No email Proceeded to logged in page')
  }
}

export const checkForVerificationCodeInput = async (page: Page) => {
  try {    
    const maybeVerificationCodeInput = '//div[@class="card"]//input'
    await page.waitForSelector(maybeVerificationCodeInput, { timeout: 2000 })
    const confirmButton = page.locator('button:has-text("Confirm")')
    const verificationCode = await getVerificationCode(process.env.E2E_TEST_ACCOUNT_FREE as string, page)
    await page.locator(maybeVerificationCodeInput).fill(verificationCode)
    await confirmButton.click()
  } catch (error) {
    console.error('No email proceeding to logged in page')
  }
}

export const generateRandomEmail = async () => {  
  return `${Date.now()}_tstact@restmail.net`;
};

export const setEnvVariables = async (email: string) => {
  // set env variable -- stage will currently be the default
  let E2E_TEST_BASE_URL = 'https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net'
  let E2E_TEST_ENV = 'stage'

  // set base urls
  switch (process.env.NODE_ENV) {
      case 'prod':
          E2E_TEST_BASE_URL = 'https://relay.firefox.com';
          E2E_TEST_ENV = 'prod'
          break;
      case 'stage':
          E2E_TEST_BASE_URL = 'https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net';
          E2E_TEST_ENV = 'stage'
          break;
      case 'local':
          E2E_TEST_BASE_URL = 'http://localhost:3000';
          E2E_TEST_ENV = 'local'
          break;
      default:
          break;
  }

  process.env['E2E_TEST_ACCOUNT_FREE'] = email;
  process.env['E2E_TEST_BASE_URL'] = E2E_TEST_BASE_URL
  process.env['E2E_TEST_ENV'] = E2E_TEST_ENV
}

interface DefaultScreenshotOpts {
  animations?: "disabled" | "allow" | undefined
  maxDiffPixelRatio?: number | undefined;
}

export const defaultScreenshotOpts: Partial<DefaultScreenshotOpts> = {
  animations: 'disabled',
  maxDiffPixelRatio: 0.04
};