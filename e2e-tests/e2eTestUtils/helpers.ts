import { APIRequestContext, Page } from '@playwright/test';

export const waitForRestmail = async (req: APIRequestContext, testEmail: string, attempts = 10) => {
    if (attempts === 0) {
        throw new Error('Unable to retrieve restmail data');
    }

    try {
      const response = await req.get(
          `http://restmail.net/mail/${testEmail}`,
          {
          failOnStatusCode: false
          }
      );
      
      const resJson = JSON.parse(await response.text());
    
      if (resJson.length) {
          const rawCode = resJson[0].subject
          const verificationCode = rawCode.split(':')[1].trim()
          return verificationCode as string;
      } else {
        await delay(1000);
        await waitForRestmail(req, testEmail, attempts - 1);
      }
      
    } catch {
      throw Error('Unable to return restmail from GET api')
    }
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
    await page.waitForNavigation() 
    await page.locator(maybeSignInButton).click()
  } catch (error) {
    console.error('Proceeded to logged in page')
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

export const generateMaskResponseObject =  {
  mask_type: "random",
  enabled: true,
  description: "lfjldksjfkldsjflksjlkj",
  generated_for: "",
  block_list_emails: false,
  used_on: null,
  id: Date.now(),
  address: "sdlfkjdskjfs",
  domain: 2,
  full_address: `sdlfkjdskjfs@${process.env.E2E_TEST_BASE_URL}`,
  created_at: "2022-07-19T15:22:52.803508Z",
  last_modified_at: "2022-07-19T15:22:52.803523Z",
  last_used_at: null,
  num_forwarded: 0,
  num_blocked: 0,
  num_replied: 0,
  num_spam: 0  
}

export const delay = (timeInMilliSeconds: number)  =>
  new Promise(function (resolve) {
    setTimeout(resolve, timeInMilliSeconds);
  });