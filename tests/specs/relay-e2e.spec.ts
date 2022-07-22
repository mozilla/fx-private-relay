import test, { expect }  from '../fixtures/basePages'
import {
  delay, 
  deleteEmailAddressMessages, 
  generateRandomEmail, 
  waitForRestmail } from '../utils/helpers';

test.describe('Relay e2e function email forwarding', () => {
    // use stored authenticated state
    test.use({ storageState: 'state.json' })

    test.beforeEach(async ({ dashboardPage, page, context, request }) => {
        // reset data
        await dashboardPage.open()
        await dashboardPage.deleteMask()  
        
        // create mask and use generated mask email to test email forwarding feature
        await dashboardPage.generateMask(1)
        const generatedMaskEmail = await dashboardPage.maskCardGeneratedEmail.textContent()
    
        const monitorTab = await context.newPage()
        await monitorTab.goto("https://monitor.firefox.com/")
    
        const checkForBreachesEmailInput = monitorTab.locator('#scan-email').first();
        const newsLetterCheckBox = '.create-fxa-checkbox-checkmark';
        const CheckForBreachesButton = monitorTab.locator('#scan-user-email [data-entrypoint="fx-monitor-check-for-breaches-blue-btn"]').first();
    
        await checkForBreachesEmailInput.fill(generatedMaskEmail as string)
        await monitorTab.check(newsLetterCheckBox)    
        await Promise.all([
          monitorTab.waitForNavigation(),
          CheckForBreachesButton.click()
        ]);
    
        const passwordInputField = monitorTab.locator('#password');
        const passwordConfirmInputField = monitorTab.locator('#vpassword');
        const ageInputField = monitorTab.locator('#age');
        const createAccountButton = monitorTab.locator('#submit-btn');
        const testFirefoxProductsOption = '#test-pilot';
    
        await passwordInputField.fill(process.env.TEST_ACCOUNT_PASSWORD as string);
        await passwordConfirmInputField.fill(process.env.TEST_ACCOUNT_PASSWORD as string);
        await ageInputField.fill('31');
        await monitorTab.check(testFirefoxProductsOption);
        await createAccountButton.click()
    
        // wait for email to be forward to restmail
        await waitForRestmail(request, process.env.TEST_ACCOUNT4_FREE as string)    
    });

    test('Check that the user can use the masks on websites and receive emails sent to the masks, C1553068, C1553065', async ({ 
        dashboardPage,
        context
      }) => {            
        const pages = context.pages()
        
        await expect.poll(async () => {
          await pages[0].reload({ waitUntil: 'networkidle' })
          return await dashboardPage.maskCardForwardedAmount.textContent()
        }, {
          // wait at 2 sec in between
          intervals: [2_000],
          // Poll for 10 seconds; defaults to 5 seconds. Pass 0 to disable timeout.
          timeout: 10000,
        }).toContain('1');

        await dashboardPage.userMenuButton.click()        
        await dashboardPage.signOutButton.click()        
        expect(await dashboardPage.signOutToastAlert.textContent()).toContain('You have signed out.')     
    })
})

test.describe('Relay e2e auth flows', () => {
  let testEmail: string;
  let verificationCode: string;

  test.beforeEach(async ({ landingPage }) => {    
      await landingPage.open()      
    });
  
  test.afterEach(async ({ request }) => {
      if (testEmail) await deleteEmailAddressMessages(request, testEmail)
  })

  test('Verify user can sign up for an account C1818784, C1811801, C1553064', async ({ 
      dashboardPage, 
      landingPage,
      authPage,
      request
    }) => {

      // sign up with a randomly generated email
      testEmail = await generateRandomEmail()
      await landingPage.goToSignUp()
      await authPage.signUp(testEmail, process.env.TEST_ACCOUNT_PASSWORD as string)

      // get verificaton from restmail and enter
      const waitForRestmail = async (attempts = 5) => {
        if (attempts === 0) {
          throw new Error('Unable to retrieve restmail data');
        }

        const response = await request.get(
          `http://restmail.net/mail/${testEmail}`,
          {
            failOnStatusCode: false
          }
        );

        const resJson = JSON.parse(await response.text());
        if (resJson.length) {
          const rawCode = resJson[0].subject
          verificationCode = rawCode.split(':')[1].trim()
          return;
        }

        await delay(1000);
        await waitForRestmail(attempts - 1);
      };
      await waitForRestmail();
      await authPage.enterVerificationCode(verificationCode)

      // verify successful login
      expect(await dashboardPage.signOutToastAlert.textContent()).toContain('Successfully')
      expect(await dashboardPage.signOutToastAlert.textContent()).toContain(testEmail)

      // sign out and verify successful signout
      await dashboardPage.userMenuButton.click()
      await dashboardPage.signOutButton.click()
      expect(await dashboardPage.signOutToastAlert.textContent()).toContain('You have signed out.')
  })

  test('Verify that the "Sign Up" button works correctly, C1818792', async ({     
    landingPage
  }) => {    
    await landingPage.selectPricingPlanSignUp()

    // verify redirect to subscription page
    expect(await landingPage.subscriptionTitle.textContent()).toContain('Set up your subscription')
  })
})