import test, { expect }  from '../fixtures/basePages'
import { chooseAvailableFreeEmail, deleteEmailAddressMessages, generateRandomEmail, waitForRestmail } from '../utils/emailHelper';

test.describe('Relay e2e function email forwarding', () => {
    let currentTestEmail: string;

    test.beforeEach(async ({ landingPage, authPage, dashboardPage, page }) => {
        // go to relay sign in page
        await landingPage.open()
        await landingPage.goToSignIn()

        // choose user
        currentTestEmail = await chooseAvailableFreeEmail()
        await page.pause()
        await authPage.login(currentTestEmail, process.env.TEST_ACCOUNT_PASSWORD)

        // clear data
        await dashboardPage.deleteMask(true)
    });
      
    test.afterEach(async ({ dashboardPage, request }) => {
        let masksAvailable: number;
        try {
          masksAvailable = await dashboardPage.maskCard.count()
          await dashboardPage.deleteMask(true, masksAvailable)
        } catch(err){
          console.log(err)
        }
        await deleteEmailAddressMessages(request, currentTestEmail)
    })

    test('Check that the user can use the masks on websites and receive emails sent to the masks, C1553068, C1553065', async ({ 
        dashboardPage, 
        page, 
        context,
        request 
      }) => {
        await page.pause()
        await dashboardPage.generateMask(1)
        const generatedMaskEmail = await dashboardPage.maskCardGeneratedEmail.textContent()
    
        const monitorTab = await context.newPage()
        await monitorTab.goto('https://monitor.firefox.com')
    
        const checkForBreachesEmailInput = monitorTab.locator('#scan-email').first();
        const newsLetterCheckBox = '.create-fxa-checkbox-checkmark';
        const CheckForBreachesButton = monitorTab.locator('#scan-user-email [data-entrypoint="fx-monitor-check-for-breaches-blue-btn"]').first();
    
        await checkForBreachesEmailInput.fill(generatedMaskEmail)
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
    
        await passwordInputField.fill(process.env.TEST_ACCOUNT_PASSWORD);
        await passwordConfirmInputField.fill(process.env.TEST_ACCOUNT_PASSWORD);
        await ageInputField.fill('31');
        await monitorTab.check(testFirefoxProductsOption);
        await createAccountButton.click()
    
        // wait for email to be forward to restmail
        await waitForRestmail(request, currentTestEmail)
    
        // const origTab = context.pages()[0]
        await page.reload({ waitUntil: 'networkidle' })
     
        // expect(await dashboardPage.maskCardForwardedAmount.textContent()).toContain('1')
        await expect.poll(async () => {
          await page.reload({ waitUntil: 'networkidle' })
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

test.skip('Relay e2e auth flows', () => {
  let testEmail: string;

  test.beforeEach(async ({ landingPage }) => {    
      await landingPage.open()      
    });
  
  test.afterEach(async ({ request }) => {
      if (testEmail) await deleteEmailAddressMessages(request, testEmail)
  })

  test.fixme('Verify user can sign up for an account C1818784, C1811801, C1553064', async ({ 
      dashboardPage, 
      landingPage,
      authPage,
      request
    }) => {

      // sign up with a randomly generated email
      testEmail = await generateRandomEmail()
      await landingPage.goToSignUp()
      await authPage.signUp(testEmail, process.env.TEST_ACCOUNT_PASSWORD)

      // get verificaton from restmail and enter
      const code = await waitForRestmail(request, testEmail)
      console.log('Verification Code: ', code)
      await authPage.enterVerificationCode(code)

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