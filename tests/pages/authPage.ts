import { Locator, Page } from "@playwright/test";

export class AuthPage {
    readonly page: Page
    readonly emailInputField: Locator
    readonly passwordInputField: Locator
    readonly passwordConfirmInputField: Locator
    readonly continueButton: Locator
    readonly ageInputField: Locator
    readonly testFirefoxProductsOption: string
    readonly verifyCodeInputField: Locator

    constructor(page: Page){
        this.page = page;
        this.emailInputField = page.locator('.email');
        this.passwordInputField = page.locator('#password');        
        this.passwordConfirmInputField = page.locator('#vpassword');
        this.ageInputField = page.locator('#age');
        this.testFirefoxProductsOption = '#test-pilot';
        this.continueButton = page.locator('#submit-btn');
        this.verifyCodeInputField = page.locator('//*[@id="main-content"]/section/form/div[1]/input')
    }

    async continue() {
        await Promise.all([
            this.page.waitForNavigation(),
            this.continueButton.click()
        ]);
    }

    async enterVerificationCode(code: string){
        await this.verifyCodeInputField.fill(code)
        await this.continue()
    }

    async enterRandomAge() {
        const randomAge = Math.floor(Math.random() * (40 - 30 + 1)) + 30;
        await this.ageInputField.type(randomAge.toString());
    }

    async enterEmail(email: string) {
        await this.emailInputField.fill(email);
        await this.continue();
    }

    async enterPassword(password: string) {
        await this.passwordInputField.fill(password);
        await this.continue();
    }
    
    async login(email: string, password: string) {
        await this.enterEmail(email);
        await this.enterPassword(password);
    }

    async signUp(email: string, password: string){
        await this.enterEmail(email)
        await this.passwordInputField.fill(password);
        await this.passwordConfirmInputField.fill(password);
        await this.enterRandomAge()
        await this.page.check(this.testFirefoxProductsOption);
        await this.continue();
    }
}