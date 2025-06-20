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
  readonly planDetails3: Locator;
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
    this.subscription3Title = page.getByRole("heading", {
      name: "Set up your subscription",
    });
    this.planDetails = page.locator("#plan-details-product");
    this.planDetails3 = page.locator("#product-details-heading");
    this.planType = page.locator(".plan-details-description");
    this.planType3 = page.getByTestId("total-price");
  }

  private isVersion3(): boolean {
    return this.page.url().includes("payments-next");
  }

  async getSubscriptionTitleText(): Promise<string> {
    if (this.isVersion3()) {
      return await this.subscription3Title.textContent();
    }
    return await this.subscriptionTitle.textContent();
  }

  async getPlanDetailsText(): Promise<string> {
    if (this.isVersion3()) {
      return await this.planDetails3.textContent();
    }
    return await this.planDetails.textContent();
  }

  async getPriceDetailsText(): Promise<string> {
    if (this.isVersion3()) {
      return await this.planType3.textContent();
    }
    return await this.planType.textContent();
  }
}
