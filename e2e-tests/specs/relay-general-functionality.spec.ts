import test, { expect }  from '../fixtures/basePages'
import { checkAuthState, defaultScreenshotOpts, ENV_DOMAINS } from '../e2eTestUtils/helpers';

// using logged in state outside of describe block will cover state for all tests in file
test.use({ storageState: 'state.json' })
test.describe('Free - General Functionalities, Desktop', () => {
  test.beforeEach(async ({ dashboardPage, page }) => {
    await dashboardPage.open()
    await checkAuthState(page)
    await dashboardPage.maybeDeleteMasks()
  });
  
  test('Check the free user can only create 5 masks, C1553067', async ({ dashboardPage }) => {
    await dashboardPage.generateMask(5)
    
    // After five times, the button becomes greyed-out and the user cannot add other masks anymore (TODO: for a free user from a country where Premium is NOT available).
    expect(await dashboardPage.maxMaskLimitButton.textContent()).toContain('Get unlimited email masks')
  })
  
  test('Check that when generating a new mask, its card is automatically opened, C1686210, C1553075, C1553064', async ({ dashboardPage }) => {
    await dashboardPage.generateMask(1)
    
    await expect(dashboardPage.maskCardExpanded).toBeVisible()
    expect(await dashboardPage.maskCardHeader.textContent()).toContain(ENV_DOMAINS[process.env.E2E_TEST_ENV as string])
  })
})

test.describe('Free - General Functionalities, Desktop - Visual Regression', () => {
  test.skip(({ browserName }) => browserName !== 'firefox', 'firefox only image comparisons!');

  test.beforeEach(async ({ dashboardPage, page }) => {
    await dashboardPage.open()
    await checkAuthState(page)
    await dashboardPage.maybeDeleteMasks()
  });    

  test('Verify that the Header is displayed correctly for a Free user that is logged in, C1812639', async ({ dashboardPage }) => {
    await dashboardPage.maybeCloseToaster()
    await expect(dashboardPage.header).toHaveScreenshot(
      `${process.env.E2E_TEST_ENV}-dashboardHeader.png`,
      {...defaultScreenshotOpts, mask: [dashboardPage.userMenuLetter] }
    );
  })

  test.fixme('Verify that the "Profile" button and its options work correctly, C1812641', async ({ dashboardPage }) => {    
    await dashboardPage.relayExtensionBanner.scrollIntoViewIfNeeded()
    await expect(dashboardPage.relayExtensionBanner).toHaveScreenshot(
      `${process.env.E2E_TEST_ENV}-relayExtensionBanner.png`,
      defaultScreenshotOpts
    );

    await dashboardPage.bottomUgradeBanner.scrollIntoViewIfNeeded()
    await expect(dashboardPage.bottomUgradeBanner).toHaveScreenshot(
      `${process.env.E2E_TEST_ENV}-bottomUgradeBanner.png`,
      defaultScreenshotOpts
    );
  })

  test('Verify that opened mask cards are displayed correctly to a Free user, C1553070', async ({ dashboardPage, page }) => {
    await dashboardPage.generateMask(1)
    await expect(page.locator(dashboardPage.maskCard)).toHaveScreenshot(`${process.env.E2E_TEST_ENV}-maskCard.png`, 
    {...defaultScreenshotOpts, mask: [
      dashboardPage.maskCardForwardEmail, 
      dashboardPage.maskCardGeneratedEmail, 
      dashboardPage.maskCardCreatedDate
    ]});
  })

  test('Check that the user can delete an mask, and is prompted to confirm before they delete, C1553071', async ({ dashboardPage }) => {
    await dashboardPage.generateMask(1)
    await dashboardPage.maskCardDeleteButton.click()

    await expect(dashboardPage.maskCardDeleteDialogModal).toHaveScreenshot(`${process.env.E2E_TEST_ENV}-maskCardDeleteDialogModal.png`,
    {...defaultScreenshotOpts, mask: [
      dashboardPage.maskCardDeleteDialogModalEmailString, 
      dashboardPage.maskCardDeleteDialogModalGeneratedEmail
    ]});

    await dashboardPage.maskCardCancelButton.click()
  })
})