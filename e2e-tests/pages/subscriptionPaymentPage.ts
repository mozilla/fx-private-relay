import { Locator, Page } from "@playwright/test";

export class SubscriptionPaymentPage {
    readonly page: Page
    readonly paypalButton: Locator
    readonly paymentDiv: Locator
    readonly productDetails: Locator
    readonly discountForm: Locator
    readonly paymentNameField: Locator
    readonly cardNumberField: Locator
    readonly cardExpiryField: Locator
    readonly cardCvcField: Locator
    readonly postalCodeField: Locator
    readonly authorizationCheckbox: Locator

    constructor(page: Page) {
        this.page = page
        this.authorizationCheckbox = page.locator('[data-testid="confirm"]')
        this.paypalButton = page.locator('[data-testid="pay-with-other"]')
        this.paymentDiv = page.locator('[data-testid="subscription-create"]')
        this.productDetails = page.locator('.plan-details-component-inner')
        this.discountForm = page.locator('[data-testid="coupon-component"]')
        this.paymentNameField = page.locator('[data-testid="name"]')
        this.cardNumberField = page.locator('[data-elements-stable-field-name="cardNumber"]')
        this.cardExpiryField = page.locator('[data-elements-stable-field-name="cardExpiry"]')
        this.cardCvcField = page.locator('[data-elements-stable-field-name="cardCvc"]')
        this.postalCodeField = page.locator('[data-elements-stable-field-name="postalCode"]')
    }   
}