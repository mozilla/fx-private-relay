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

export const chooseAvailableFreeEmail = async (): Promise<string> => {
 const availableEmails = [
   process.env.TEST_ACCOUNT1_FREE,
   process.env.TEST_ACCOUNT2_FREE,
   process.env.TEST_ACCOUNT3_FREE,
   process.env.TEST_ACCOUNT4_FREE
 ]

 return availableEmails[Math.floor(Math.random() * availableEmails.length)] as string
}

interface DefaultScreenshotOpts {
  animations?: "disabled" | "allow" | undefined
  maxDiffPixelRatio?: number | undefined;
}

export const defaultScreenshotOpts: Partial<DefaultScreenshotOpts> = {
  animations: 'disabled',
  maxDiffPixelRatio: 0.04
};

// const getAuthPW = () => {
//   return uint8ToHex(new Uint8Array(authPW))
// }

// const authPW = crypto.subtle.deriveBits(
//   {
//     name: 'HKDF',
//     salt: new Uint8Array(0),
//     // The builtin ts type definition for HKDF was wrong
//     // at the time this was written, hence the ignore
//     // @ts-ignore
//     info: encoder().encode(`${NAMESPACE}authPW`),
//     hash: 'SHA-256',
//   },
//   quickStretchedKey,
//   256
// );

// const passkey = crypto.subtle.importKey(
//   'raw',
//   encoder().encode(process.env.TESTACCOUNT_PASSWORD),
//   'PBKDF2',
//   false,
//   ['deriveBits']
// );

// const quickStretchedRaw = crypto.subtle.deriveBits(
//   {
//     name: 'PBKDF2',
//     salt: encoder().encode(`${NAMESPACE}quickStretch:${email}`),
//     iterations: 1000,
//     hash: 'SHA-256',
//   },
//   passkey,
//   256
// );

// const quickStretchedKey = crypto.subtle.importKey(
//   'raw',
//   quickStretchedRaw,
//   'HKDF',
//   false,
//   ['deriveBits']
// );

// function uint8ToHex(uint8Array = []) {
//   return uint8Array.reduce(
//     (str, byte) => str + ('00' + byte.toString(16)).slice(-2),
//     ''
//   );
// }

// const login = (req, email, attempts = 10) => {
//   if (attempts === 0) {
//     throw new Error('Unable to retrieve restmail data');
// }

// const response = req.get(
//     'https://api.accounts.firefox.com/v1/account/create',
//     {
//     failOnStatusCode: false
//     }
// );
// }

export const delay = (timeInMilliSeconds: number)  =>
  new Promise(function (resolve) {
    setTimeout(resolve, timeInMilliSeconds);
  });