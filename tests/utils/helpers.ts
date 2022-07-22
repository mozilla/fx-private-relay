import { APIRequestContext } from '@playwright/test';

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
      console.log(`Confirm restmail email attempt number: ${attempts} for mask email: ${testEmail}`)
    
      if (resJson.length) {
          const rawCode = resJson[0].subject
          const verificationCode = rawCode.split(':')[1].trim()
          console.log('Restmail Return Code: ', verificationCode)
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
      console.log(`Cleaned up ${testEmail} email messages from restmail`)
    } catch (err) {
      console.log('ERROR DELETE RESTMAIL EMAIL', err);
    }
  };

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

const generateRandomNumber = (numberLength = 7) => {
  let word = '';
  let possibleWordLetters =
    '1234567890';

  for (let i = 0; i < numberLength; i++) {
    word += possibleWordLetters.charAt(
      Math.floor(Math.random() * possibleWordLetters.length)
    );
  }

  return word;
};

const generateRandomWord = (wordLength = 9) => {
  let word = '';
  let possibleWordLetters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  for (let i = 0; i < wordLength; i++) {
    word += possibleWordLetters.charAt(
      Math.floor(Math.random() * possibleWordLetters.length)
    );
  }

  return word;
};

export const generateMaskResponseObject =  {
    mask_type: "random",
    enabled: true,
    description: "lfjldksjfkldsjflksjlkj",
    generated_for: "",
    block_list_emails: false,
    used_on: null,
    id: generateRandomNumber(),
    address: "sdlfkjdskjfs",
    domain: 2,
    full_address: `sdlfkjdskjfs@${process.env.TEST_BASE_URL}`,
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