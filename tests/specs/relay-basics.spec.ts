import test, { expect }  from '../fixtures/basePages'
import { defaultScreenshotOpts } from '../utils/helpers';

test.describe('Firefox Relay - Landing Page', () => {
  test.beforeEach(async ({ landingPage }) => {
    await landingPage.open()
  });

  test('Verify that the header is displayed correctly for a user that is NOT logged in, C1812637', async ({ landingPage }) => {    
    await expect(landingPage.header).toHaveScreenshot(
      'landingHeader.png',
      defaultScreenshotOpts
    );
  });  
});


test.describe('Check header buttons and their redirects,  C1812638',  () => {
  test.beforeEach(async ({ landingPage }) => {
    await landingPage.open()
  });  

  test('Verify home FAQ button redirect', async ({ landingPage, page }) => {
    await landingPage.goToFAQ() 
    expect(page.url()).toContain('https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/faq/')
  })

  test('Verify home button redirect', async ({ landingPage, page }) => {      
    await landingPage.goHome()
    expect(page.url()).toContain('https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/')
  }) 
  
  test('Verify home firefox logo redirect', async ({ landingPage, page }) => {      
    await landingPage.goToFAQ()
    await landingPage.clickFirefoxLogo()
    expect(page.url()).toContain('https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/')
  }) 

  test('Verify sign in button authentication flow', async ({ landingPage, page }) => {      
    await landingPage.goToSignIn()
    expect(page.url()).toContain('accounts.stage.mozaws.net')      
  })

  test('Verify  sign up button authentication flow', async ({ landingPage, page }) => {        
    await landingPage.goToSignUp()
    expect(page.url()).toContain('accounts.stage.mozaws.net')
  })

  test('Verify firefox apps and service', async ({ landingPage }) => {        
    await landingPage.openFirefoxAppsServices()
    await expect(landingPage.firefoxAppsServicesExpanded).toHaveScreenshot(
      'firefoxAppsServicesExpanded.png',
      defaultScreenshotOpts
    );
  })   
});