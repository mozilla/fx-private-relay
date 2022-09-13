import { Locator, Page } from "@playwright/test";

export class LandingPage {
    readonly page: Page
    readonly header: Locator
    readonly FAQButton: Locator
    readonly homeButton: Locator
    readonly signUpButton: Locator
    readonly subscriptionTitle: Locator
    readonly planPricingSignUpButton: Locator
    readonly signInButton: Locator
    readonly firefoxAppsServices: Locator
    readonly firefoxAppsServicesExpanded: Locator
    readonly firefoxLogo: Locator

    constructor(page: Page){
        this.page = page
        this.header = page.locator('#overlayProvider header')
        this.FAQButton = page.locator('header >> text=FAQ')
        this.homeButton = page.locator('header >> text=Home')
        this.signUpButton = page.locator('a:has-text("Sign Up")').first()
        this.planPricingSignUpButton = page.locator('//a[contains(@class, "Plans_premium-plan")]/div')
        this.subscriptionTitle = page.locator('[data-testid="subscription-create-title"]')
        this.signInButton = page.locator('a:has-text("Sign In")')
        this.firefoxAppsServices = page.locator('#react-aria-1')
        this.firefoxAppsServicesExpanded = page.locator('#react-aria-2')
        this.firefoxLogo = page.locator('//a[starts-with(@class, "Layout_logo")]')
    }
 
    async open(){
        await this.page.goto(process.env.E2E_TEST_BASE_URL as string)
    }

    async goHome(){
        await Promise.all([
            this.page.waitForNavigation(),
            this.homeButton.click()
        ]);
    }

    async goToFAQ(){        
        await Promise.all([
            this.page.waitForNavigation(),
            this.FAQButton.click()
        ]);
    }

    async goToSignUp(){
        await this.signUpButton.click()
    }

    async selectPricingPlanSignUp(){
        await Promise.all([
            this.page.waitForNavigation(),
            this.planPricingSignUpButton.click()
        ]);
    }

    async goToSignIn(){
        await this.signInButton.click()
    }

    async openFirefoxAppsServices(){
        await this.firefoxAppsServices.click()
    }

    async clickFirefoxLogo(){
        await this.firefoxLogo.click()
    }
    
}