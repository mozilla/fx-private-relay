import test, { expect }  from '../fixtures/basePages'
import { checkAuthState } from '../e2eTestUtils/helpers';

test.describe.configure({ mode: 'parallel' });
test.skip(({ browserName }) => browserName !== 'firefox', 'firefox only e2e!');
test.describe('Relay e2e function email forwarding', () => { 
    // use stored authenticated state
    test.use({ storageState: 'state.json' })

    test.beforeEach(async ({ dashboardPage }) => {      
      await dashboardPage.sendMaskEmail()
    });
    
    test('Check that the user can use the masks on websites and receive emails sent to the masks, C1553068, C1553065, C1811801', async ({ 
      dashboardPage,
      page
    }) => {
        await dashboardPage.open()
        await checkAuthState(page)
        const forwardedEmailCount = await dashboardPage.checkForwardedEmailCount()
                
        expect(forwardedEmailCount).toEqual('1Forwarded')        

        await dashboardPage.userMenuButton.click()
        await dashboardPage.signOutButton.click()
        expect(await dashboardPage.signOutToastAlert.textContent()).toContain('You have signed out.')     
    })
})

test.fixme('Relay e2e auth flows', () => {
  // pricing table is being updated -- will update this test afterwords
  test.beforeEach(async ({ landingPage }) => {
      await landingPage.open()      
  });
  
  test('Verify that the "Sign Up" button works correctly, C1818792', async ({     
    landingPage
  }) => {    
    await landingPage.selectPricingPlanSignUp()

    // verify redirect to subscription page
    expect(await landingPage.subscriptionTitle.textContent()).toContain('Set up your subscription')
  })
})