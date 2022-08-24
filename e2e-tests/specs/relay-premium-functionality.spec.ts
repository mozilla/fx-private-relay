import test, { expect }  from '../fixtures/basePages'

test.describe.skip('Premium - General Functionalities, Desktop', () => {
  test.beforeEach(async ({ landingPage, authPage, dashboardPage }) => {
    await landingPage.open()
    await landingPage.goToSignIn()
    await authPage.login(process.env.E2E_TEST_ACCOUNT_PREMIUM as string)
    await dashboardPage.maybeDeleteMasks()
  });

  test('Check the premium user can more than 5 masks', async ({ dashboardPage }) => {
    await dashboardPage.generateMask(6)
    
    await expect.poll(async () => {
      return await dashboardPage.emailMasksUsedAmount.textContent()
    }, {
      intervals: [1_000]
    }).toContain('6');
  })
})