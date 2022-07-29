import { APIRequestContext, Page } from '@playwright/test';

export const getVerificationCode = async (req: APIRequestContext, testEmail: string, page: Page, attempts = 10) => {
  if (attempts === 0) {
    throw new Error('Unable to retrieve restmail data');
  }
    
  const res = await req.get(
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
  return getVerificationCode(req, testEmail, page, attempts - 1);
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
    const maybeSignInButton = page.locator('button:has-text("Sign up or sign in")')
    await page.locator(maybeEmailInput).fill(process.env.E2E_TEST_ACCOUNT_FREE as string)
    await maybeSignInButton.click()
    await page.locator('#password').fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string)
    await page.locator('#submit-btn').click()
  } catch (error) {
    console.error('No email Proceeded to logged in page')
  }
}

export const generateRandomEmail = async () => {  
  return `${Date.now()}_tstact@restmail.net`;
};

interface DefaultScreenshotOpts {
  animations?: "disabled" | "allow" | undefined
  maxDiffPixelRatio?: number | undefined;
}

export const defaultScreenshotOpts: Partial<DefaultScreenshotOpts> = {
  animations: 'disabled',
  maxDiffPixelRatio: 0.04
};