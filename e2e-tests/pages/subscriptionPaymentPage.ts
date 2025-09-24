import { Locator, Page } from "@playwright/test";

export class SubscriptionPaymentPage {
  readonly page: Page;
  readonly paypalButton: Locator;
  readonly paymentDiv: Locator;
  readonly productDetails: Locator;
  readonly discountForm: Locator;
  readonly paymentNameField: Locator;
  readonly cardNumberField: Locator;
  readonly cardExpiryField: Locator;
  readonly cardCvcField: Locator;
  readonly postalCodeField: Locator;
  readonly authorizationCheckbox: Locator;
  readonly subscriptionTitle: Locator;
  readonly subscription3Title: Locator;
  readonly subscriptionType: Locator;
  readonly planDetails: Locator;
  readonly planType: Locator;
  readonly planType3: Locator;

  constructor(page: Page) {
    this.page = page;
    this.authorizationCheckbox = page.locator('[data-testid="confirm"]');
    this.paypalButton = page.locator('[data-testid="pay-with-other"]');
    this.paymentDiv = page.locator('[data-testid="subscription-create"]');
    this.productDetails = page.locator(".plan-details-component-inner");
    this.discountForm = page.locator('[data-testid="coupon-component"]');
    this.paymentNameField = page.locator('[data-testid="name"]');
    this.cardNumberField = page.locator(
      '[data-elements-stable-field-name="cardNumber"]',
    );
    this.cardExpiryField = page.locator(
      '[data-elements-stable-field-name="cardExpiry"]',
    );
    this.cardCvcField = page.locator(
      '[data-elements-stable-field-name="cardCvc"]',
    );
    this.postalCodeField = page.locator(
      '[data-elements-stable-field-name="postalCode"]',
    );
    this.subscriptionTitle = page.locator(
      '[data-testid="subscription-create-title"]',
    );
    this.subscription3Title = page.locator("#subscription-heading");
    this.planDetails = page.locator("#product-details-heading");
    this.planType = page.locator(".plan-details-description");
    // this is ugly but someone repeated the datatest-id="total-price" in the component
    this.planType3 = page.locator(
      ".overflow-hidden.text-ellipsis.text-lg.whitespace-nowrap",
    );
  }

  async getSubscriptionTitleText(): Promise<string> {
    const text = await this.subscription3Title.textContent();

    if (!text) {
      throw new Error("Subscription title text not found.");
    }

    return text;
  }

  async getPlanDetailsText(): Promise<string> {
    const text = await this.planDetails.textContent();
    if (!text) {
      throw new Error("Get Plan title text not found.");
    }

    return text;
  }

  async getPriceDetailsText(): Promise<string> {
    const text = await this.planType3.textContent();

    if (!text) {
      throw new Error("Get Plan type text not found.");
    }

    return text;
  }
}
