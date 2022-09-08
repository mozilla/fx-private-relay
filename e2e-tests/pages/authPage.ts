import { Locator, Page } from "@playwright/test";

export class AuthPage {
    readonly page: Page
    readonly emailInputField: Locator
    readonly passwordInputField: Locator
    readonly passwordConfirmInputField: Locator
    readonly continueButton: Locator
    readonly ageInputField: Locator
    readonly verifyCodeInputField: Locator

    constructor(page: Page){
        this.page = page;
        this.emailInputField = page.locator('input[name="email"]');
        this.passwordInputField = page.locator('#password');        
        this.passwordConfirmInputField = page.locator('#vpassword');
        this.ageInputField = page.locator('#age');
        this.continueButton = page.locator('#submit-btn');
        this.verifyCodeInputField = page.locator('div.card input')
    }

    async continue() {
        await this.continueButton.click()
    }

    async enterVerificationCode(code: string){
        await this.verifyCodeInputField.fill(code)
        await this.continue()
    }

    async enterEmail(email: string) {
        await this.emailInputField.fill(email);
        await this.continue();
    }

    async enterPassword() {
        await this.passwordInputField.fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
        await this.continue();
    }
    
    async login(email: string) {
        await this.enterEmail(email);
        await this.enterPassword();
    }

    async signUp(email: string){
        await this.enterEmail(email)
        await this.passwordInputField.fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
        await this.passwordConfirmInputField.fill(process.env.E2E_TEST_ACCOUNT_PASSWORD as string);
        await this.ageInputField.type("31");
        await this.continue();
    }
}