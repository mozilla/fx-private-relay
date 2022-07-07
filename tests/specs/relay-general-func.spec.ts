import test, { expect }  from '../fixtures/basePages'
import { chooseAvailableFreeEmail } from '../utils/emailHelper';

test.describe('Free - General Functionalities, Desktop', () => {
    let currentTestEmail: string;

    test.beforeEach(async ({ landingPage, authPage, dashboardPage }) => {
      // go to relay sign in page
      await landingPage.open()
      await landingPage.goToSignIn()

      // choose user
      currentTestEmail = await chooseAvailableFreeEmail()
      await authPage.login(currentTestEmail, process.env.TEST_ACCOUNT_PASSWORD)
      await dashboardPage.deleteMask(true)
    });
  
    test.afterEach(async ({ dashboardPage }) => {
      let masksAvailable: number;
      try {
        masksAvailable = await dashboardPage.maskCard.count()
        await dashboardPage.deleteMask(true, masksAvailable)
      } catch(err){
        console.log('Error interacting with masks',err)
      }
    })
  
    test('Verify that the Header is displayed correctly for a Free user that is logged in, C1812639', async ({ dashboardPage }) => {
      await expect(dashboardPage.header).toHaveScreenshot(
        'dashboardHeader.png',
        {
          animations: 'disabled',
          maxDiffPixelRatio: 0.02,        
        }
      );
    })
  
    test('Verify that the "Upgrade" button redirects correctly,  C1812640, 1808503', async ({ dashboardPage, page }) => {
      await dashboardPage.upgrade()
      expect(page.url()).toContain('/premium/')   
    })
  
    test('Verify that the "Profile" button and its options work correctly, C1812641', async ({ dashboardPage }) => {
      await dashboardPage.userMenuButton.click()
      await expect(dashboardPage.userMenuPopUp).toHaveScreenshot(
        'userMenuPopUp.png',
        {
          animations: 'disabled',
          maxDiffPixelRatio: 0.02,        
        }
      );
      await dashboardPage.userMenuButton.click()
  
  
      await dashboardPage.relayExtensionBanner.scrollIntoViewIfNeeded()
      await expect(dashboardPage.relayExtensionBanner).toHaveScreenshot(
        'relayExtensionBanner.png',
        {
          animations: 'disabled',
          maxDiffPixelRatio: 0.02,        
        }
      );
  
  
      await dashboardPage.bottomUgradeBanner.scrollIntoViewIfNeeded()
      await expect(dashboardPage.bottomUgradeBanner).toHaveScreenshot(
        'bottomUgradeBanner.png',
        {
          animations: 'disabled',
          maxDiffPixelRatio: 0.02,        
        }
      );
    })
  
    test('Check the free user can only create 5 masks, C1553067', async ({ dashboardPage, page }) => {
      await dashboardPage.generateMask(5)
      
      // After five times, the button becomes greyed-out and the user cannot add other masks anymore (TODO: for a free user from a country where Premium is NOT available).
      expect(await dashboardPage.maxMaskLimitButton.textContent()).toContain('Get unlimited email masks')
    })
  
    test('Check that when generating a new mask, its card is automatically opened, C1686210, C1553075', async ({ dashboardPage }) => {
        await dashboardPage.generateMask(1)
        await expect(dashboardPage.maskCardExpanded).toBeVisible()
        expect(await dashboardPage.maskCardHeader.textContent()).toContain('@mozmail.fxprivaterelay.nonprod.cloudops.mozgcp.net')
    })  
  
    test('Verify that opened mask cards are displayed correctly to a Free user, C1553070', async ({ dashboardPage }) => {
      await dashboardPage.generateMask(1)
      await expect(dashboardPage.maskCard).toHaveScreenshot('maskCard.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
        mask: [
          dashboardPage.maskCardForwardEmail, 
          dashboardPage.maskCardGeneratedEmail, 
          dashboardPage.maskCardCreatedDate
        ]
      });
    })
  
    test('Check that the user can delete an mask, and is prompted to confirm before they delete, C1553071', async ({ dashboardPage }) => {
      await dashboardPage.generateMask(1)
      await dashboardPage.maskCardDeleteButton.click()

      await expect(dashboardPage.maskCardDeleteDialogModal).toHaveScreenshot('maskCardDeleteDialogModal.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
        mask: [
          dashboardPage.maskCardDeleteDialogModalEmailString, 
          dashboardPage.maskCardDeleteDialogModalGeneratedEmail
        ]
      });

      await dashboardPage.maskCardCancelButton.click()
    })
})

test.describe('Free - General Functionalities, Desktop - Mask Status', () => {
  let currentTestEmail: string;

  test.beforeEach(async ({ landingPage, authPage, dashboardPage }) => {
    // go to relay sign in page
    await landingPage.open()
    await landingPage.goToSignIn()

    // choose user
    currentTestEmail = await chooseAvailableFreeEmail()
    await authPage.login(currentTestEmail, process.env.TEST_ACCOUNT_PASSWORD)
    await dashboardPage.deleteMask(true)
  });

  test.afterEach(async ({ dashboardPage }) => {
    let masksAvailable: number;
    try {
      masksAvailable = await dashboardPage.maskCard.count()
      await dashboardPage.deleteMask(true, masksAvailable)
    } catch(err){
      console.log(err)
    }
  })

  test('Verify that the Header is displayed correctly for a Free user that is logged in, C1812639', async ({ dashboardPage }) => {
    await expect(dashboardPage.header).toHaveScreenshot(
      'dashboardHeader.png',
      {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,        
      }
    );
  });
})