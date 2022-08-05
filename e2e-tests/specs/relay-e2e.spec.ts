import test, { expect }  from '../fixtures/basePages'
import {
  checkForEmailInput,
  checkForSignInButton,
  checkForVerificationCodeInput,
  deleteEmailAddressMessages } from '../e2eTestUtils/helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only image comparisons!');
// skip CI runs until issue is fixed
test.describe('Relay e2e function email forwarding', () => {    
    // use stored authenticated state
    test.use({ storageState: 'state.json' })

    test.beforeEach(async ({ dashboardPage, request }) => {
      await dashboardPage.sendMaskEmail(request)
    });
    
    test('Check that the user can use the masks on websites and receive emails sent to the masks, C1553068, C1553065', async ({ 
      dashboardPage,
      page
    }) => {
        await dashboardPage.open()
        await checkForSignInButton(page)
        await checkForEmailInput(page)
        await checkForVerificationCodeInput(page)
        const forwardedEmailCount = await dashboardPage.checkForwardedEmailCount()
        
        expect(forwardedEmailCount).toEqual('1Forwarded')        

        await dashboardPage.userMenuButton.click()
        await dashboardPage.signOutButton.click()
        expect(await dashboardPage.signOutToastAlert.textContent()).toContain('You have signed out.')     
    })
})

test.describe('Relay e2e auth flows', () => {
  let testEmail: string;

  test.beforeEach(async ({ landingPage }) => {
      await landingPage.open()      
  });
  
  test.afterEach(async ({ request }) => {
      if (testEmail) await deleteEmailAddressMessages(request, testEmail)
  })
  
  test('Verify that the "Sign Up" button works correctly, C1818792', async ({     
    landingPage
  }) => {    
    await landingPage.selectPricingPlanSignUp()

    // verify redirect to subscription page
    expect(await landingPage.subscriptionTitle.textContent()).toContain('Set up your subscription')
  })
})