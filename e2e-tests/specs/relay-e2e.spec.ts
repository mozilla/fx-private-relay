import test, { expect }  from '../fixtures/basePages'
import { checkAuthState } from '../e2eTestUtils/helpers';

test.describe.configure({ mode: 'parallel' });
test.skip(({ browserName }) => browserName !== 'firefox', 'firefox only e2e!');
test.fixme('Relay e2e function email forwarding', () => {
    // use stored authenticated state
    test.use({ storageState: 'state.json' })

    test.beforeEach(async ({ dashboardPage }) => {
      await dashboardPage.sendMaskEmail()
    });

    test('Check that the user can use the masks on websites and receive emails sent to the masks, C1553068, C1553065, C1811801', async ({
      dashboardPage,
      page
    }) => {
        // This tests creates a new Mozilla Account with a new mask, to have
        // the signup confirmation email show up in the forwarded email count.
        // This is a pretty slow process:
        test.slow()
        await expect(async () => {
          await dashboardPage.open()
          await checkAuthState(page)
          const forwardedEmailCount = await dashboardPage.checkForwardedEmailCount()

          expect(forwardedEmailCount).toEqual('1')
        }).toPass()
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
