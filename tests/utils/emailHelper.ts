import { APIRequestContext } from '@playwright/test';

export const waitForRestmail = async (req: APIRequestContext, testEmail: string, attempts = 10): Promise<string> => {
    if (attempts === 0) {
        throw new Error('Unable to retrieve restmail data');
    }

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
        return verificationCode;
    }

    await delay(1000);
    await waitForRestmail(req, testEmail, attempts - 1);
}

export const deleteEmailAddressMessages = async (req: APIRequestContext, testEmail: string) => {
    try {
      await req.delete(`http://restmail.net/mail/${testEmail}`);
      console.log(`Cleaned up ${testEmail} email messages from restmail`)
    } catch (err) {
      console.log('ERROR DELETE RESTMAIL EMAIL', err);
    }
  };

export const generateRandomEmail = async (wordLength = 2) => {  
  return `${Date.now()}_tstact@restmail.net`;
};

export const chooseAvailableFreeEmail = async (): Promise<string> => {
 const availableEmails = [
   process.env.TEST_ACCOUNT1_FREE,
   process.env.TEST_ACCOUNT2_FREE,
   process.env.TEST_ACCOUNT3_FREE,
   process.env.TEST_ACCOUNT4_FREE
 ]

 return availableEmails[Math.floor(Math.random() * availableEmails.length)]
}

const delay = (timeInMilliSeconds: number)  =>
  new Promise(function (resolve) {
    setTimeout(resolve, timeInMilliSeconds);
  });