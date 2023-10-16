import { Locator, Page } from "@playwright/test";
import { checkAuthState, getVerificationCode } from "../e2eTestUtils/helpers";

export class DashboardPage {
    readonly page: Page
    readonly header: Locator
    readonly homeButton: Locator
    readonly FAQButton: Locator
    readonly newsButton: Locator
    readonly toastCloseButton: string
    readonly userMenuPopUp: Locator
    readonly userMenuLetter: Locator
    readonly getMoreProtectionButton: Locator
    readonly userMenuPopEmail: Locator
    readonly upgradeButton: Locator
    readonly upgradeNowButton: Locator
    readonly userMenuButton: Locator
    readonly signOutButton: Locator
    readonly signOutToastAlert: Locator
    readonly bottomUgradeBanner: Locator
    readonly relayExtensionBanner: Locator
    readonly dashBoardWithoutMasks: Locator
    readonly dashBoardWithoutMasksEmail: Locator
    readonly generateNewMaskButton: Locator
    readonly emailsForwardedAmount: Locator
    readonly emailsBlockedAmount: Locator
    readonly emailMasksUsedAmount: Locator
    readonly maskCard: Locator
    readonly maskCardString: string
    readonly maskCardExpanded: Locator
    readonly maskCardExpandButton: Locator
    readonly maskCardHeader: Locator
    readonly maskCardForwardEmail: Locator
    readonly maskCardCreatedDate: Locator
    readonly maskCardGeneratedEmail: Locator
    readonly maskCardForwardedAmount: Locator
    readonly maskCardRepliesAmount: Locator
    readonly maskCardBlockedAmount: Locator
    readonly maskCardDeleteButton: Locator
    readonly maskCardCancelButton: Locator
    readonly dashboardPageWithoutHeader: Locator
    readonly maskCardDeleteDialogModal: Locator
    readonly maskCardDeleteDialogModalEmailString: Locator
    readonly maskCardDeleteDialogModalGeneratedEmail: Locator
    readonly maskCardDeleteConfirmationCheckbox: Locator
    readonly maskCardFinalDeleteButton: Locator
    readonly maxMaskLimitButton: Locator

    constructor(page: Page){
        this.page = page;

        // dashboard header elements
        this.header = page.locator('div header').first();
        this.FAQButton = page.locator('header >> text=FAQ')
        this.newsButton = page.locator('header >> text=News')
        this.homeButton = page.locator('header >> text=Email Masks')
        this.userMenuButton = page.locator('//div[starts-with(@class, "UserMenu_wrapper")]')
        this.userMenuPopUp = page.locator('//ul[starts-with(@class, "UserMenu_popup")]')
        this.userMenuLetter = page.locator('//div[starts-with(@class, "UserMenu_wrapper")]')
        this.userMenuPopEmail = page.locator('//span[starts-with(@class, "UserMenu_account")]/b')
        this.toastCloseButton = '//div[starts-with(@class, "Layout_close")]'
        this.signOutButton = page.locator('button:has-text("Sign Out")').first()
        this.signOutToastAlert = page.locator('//div[@class="Toastify__toast-body"]')

        // dashboard elements
        this.upgradeNowButton = page.locator('a:has-text("Upgrade Now")')
        this.upgradeButton = page.locator('a:has-text("Upgrade")').first()
        this.getMoreProtectionButton = page.locator(':has-text("Get more protection")')
        this.dashboardPageWithoutHeader = page.locator('//main[starts-with(@class, "profile_profile-wrapper")]')
        this.emailsForwardedAmount = page.locator('(//dd[starts-with(@class, "profile_value")])[3]')
        this.emailsBlockedAmount = page.locator('(//dd[starts-with(@class, "profile_value")])[2]')
        this.emailMasksUsedAmount = page.locator('(//dd[starts-with(@class, "profile_value")])[1]')
        this.generateNewMaskButton = page.locator('button:has-text("Generate new mask")')
        this.maxMaskLimitButton = page.locator('//div[starts-with(@class, "AliasList_controls")]//a[starts-with(@class, "Button_button")]')
        this.bottomUgradeBanner = page.locator('//div[starts-with(@class, "profile_bottom-banner-wrapper")]')
        this.relayExtensionBanner = page.locator('//section[starts-with(@class, "profile_banners-wrapper")]/div')
        this.dashBoardWithoutMasks = page.locator('//section[starts-with(@class, "Onboarding_wrapper")]')
        this.dashBoardWithoutMasksEmail = page.locator('//section[starts-with(@class, "profile_no-premium-header")]')

        // mask card elements
        this.maskCard = page.getByRole('button', { name: 'Generate new mask' })
        this.maskCardString = '//div[starts-with(@class, "MaskCard_card")]'
        this.maskCardExpanded = page.locator('//button[starts-with(@class, "MaskCard_expand")]')
        this.maskCardExpandButton = page.locator('//button[starts-with(@class, "MaskCard_expand")]')
        this.maskCardHeader = page.locator('//div[starts-with(@class, "MaskCard_summary")]')
        this.maskCardGeneratedEmail = page.locator('//button[starts-with(@class, "MaskCard_copy")]/samp').first()
        this.maskCardForwardEmail = page.locator('//div[starts-with(@class, "Alias_forward-target")]')
        this.maskCardCreatedDate = page.locator('//div[starts-with(@class, "Alias_date-created")]')
        this.maskCardForwardedAmount = page.locator('//div[contains(@class, "MaskCard_forwarded")]/dd').first()
        this.maskCardRepliesAmount = page.locator('(//span[contains(@class, "Alias_blocked-stat")])[2]')
        this.maskCardBlockedAmount = page.locator('(//span[contains(@class, "Alias_blocked-stat")])[1]')
        this.maskCardDeleteButton = page.locator('button:has-text("Delete")')
        this.maskCardCancelButton = page.locator('button:has-text("Cancel")')
        this.maskCardDeleteDialogModal = page.locator('//div[starts-with(@class, "AliasDeletionButton_dialog-wrapper")]')
        this.maskCardDeleteDialogModalEmailString = page.locator('//div[starts-with(@class, "AliasDeletionButton_dialog-wrapper")]//strong')
        this.maskCardDeleteDialogModalGeneratedEmail = page.locator('//div[starts-with(@class, "AliasDeletionButton_dialog-wrapper")]//samp')
        this.maskCardDeleteConfirmationCheckbox = page.locator('#confirmDeletion')
        this.maskCardFinalDeleteButton = page.locator('//button[contains(@class, "Button_is-destructive")]')
    }

    async open() {
        await this.page.goto('/accounts/profile/');
    }

    async generateMask(numberOfMasks = 1){
        // check if max number of masks have been created
        if(numberOfMasks === 0){
            return
        }

        // generate a new mask and confirm
        await this.generateNewMaskButton.click()
        await this.page.waitForSelector(this.maskCardString, { timeout: 3000 })

        // randomize between 1.5-2.5 secs between each generate to deal with issue of multiple quick clicks
        await this.page.waitForTimeout((Math.random() * 2500) + 1500)
        await this.generateMask(numberOfMasks - 1)
    }

    async upgrade(){
        await Promise.all([
            this.page.waitForNavigation(),
            this.upgradeButton.click()
        ]);
    }

    async upgradeNow(){
        await Promise.all([
            this.page.waitForNavigation(),
            this.upgradeNowButton.click()
        ]);
    }

    async maybeCloseToaster(){
        try {
            await this.page.waitForSelector(this.toastCloseButton, { timeout: 2000 })
            await this.page.locator(this.toastCloseButton).click()
        } catch (error) {
            console.error('No Toaster, please proceed')
        }
    }

    async maybeDeleteMasks(clearAll = true, numberOfMasks = 1){
        let isExpanded = false

        try {
            numberOfMasks = await this.page.locator(this.maskCardString).count()
        } catch(err){}

        // check number of masks available
        if(numberOfMasks === 0){
            return
        }

        // if clear all, check if there's an expanded mask card
        if(clearAll){
            try {
                await this.page.waitForSelector(this.maskCardString, { timeout: 3000 })
            } catch (error) {
                console.error('There are no masks to delete')
                return
            }

            try {
                isExpanded = await this.page.getByRole('button', { expanded: true }).first().isVisible()
            } catch {}
        }

        // locate mask expand button only if mask is not already expanded
        if(numberOfMasks && !isExpanded){
            try {
                await this.maskCardExpanded.first().click()
            } catch {}
        }

        // delete flow
        if(numberOfMasks){
            const currentMaskCardDeleteButton = this.page.locator('button:has-text("Delete")').first()
            await currentMaskCardDeleteButton.click()
            await this.maskCardDeleteConfirmationCheckbox.click()
            await this.maskCardFinalDeleteButton.click()
        }

        // wait for 500 ms and run flow again with the next masks
        await this.page.waitForTimeout(500)
        await this.maybeDeleteMasks(true, numberOfMasks - 1)
    }

    async sendMaskEmail(){
        // reset data
        await this.open()
        await checkAuthState(this.page)
        await this.maybeDeleteMasks()

        // create mask and use generated mask email to test email forwarding feature
        await this.generateMask(1)
        const generatedMaskEmail = await this.maskCardGeneratedEmail.textContent()

        // TODO: Replace with a page under control of Relay team
        await this.page.goto("https://monitor.firefox.com/", { waitUntil: 'networkidle' })
        await this.page.locator('#scan-email-address').fill(generatedMaskEmail as string)
        await this.page.locator('button.primary').click()
        await this.page.waitForURL('**/scan**')

        await this.page.getByRole('link', {name: 'Get alerts about new breaches'}).click()

        await this.page.locator('input[name=email]').fill(generatedMaskEmail as string)
        await this.page.locator('#submit-btn').click()

        await this.page.locator('#password').fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
        await this.page.locator('#vpassword').fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
        await this.page.locator('#age').fill('31');
        await this.page.locator('#submit-btn').click()
        await this.page.waitForURL('**/confirm_signup_code**')

        // verification email from fxa to generatedMaskEmail should be forwarded to E2E_TEST_ACCOUNT_FREE
        await getVerificationCode(process.env.E2E_TEST_ACCOUNT_FREE as string, this.page)
    }

    async checkForwardedEmailCount(attempts = 10) {
        if (attempts === 0) {
            throw new Error('Email forwarded count did not update');
        }

        // force a re-request of relayaddresses
        await this.FAQButton.click()
        await this.homeButton.click()

        // check if card is expanded
        if(!(await this.page.getByRole('button', { expanded: true }).first().isVisible())){
            await this.maskCardExpanded.first().click()
        }

        // check the forward emails count, if not 0, return the current value
        const forwardCount = await this.maskCardForwardedAmount.textContent()
        if(forwardCount !== "0"){
            return forwardCount;
        }

        await this.page.waitForTimeout(1000)
        return this.checkForwardedEmailCount(attempts - 1)
    }
}
