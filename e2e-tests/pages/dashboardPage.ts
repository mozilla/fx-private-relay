import { Locator, Page, expect } from "@playwright/test";
import { checkAuthState, TIMEOUTS } from "../e2eTestUtils/helpers";

export class DashboardPage {
  readonly page: Page;
  readonly header: Locator;
  readonly homeButton: Locator;
  readonly FAQButton: Locator;
  readonly newsButton: Locator;
  readonly getMoreProtectionButton: Locator;
  readonly upgradeButton: Locator;
  readonly signOutButton: Locator;
  readonly relayExtensionBanner: Locator;
  readonly dashBoardWithoutMasks: Locator;
  readonly generateNewMaskButton: Locator;
  readonly emailMasksUsedAmount: Locator;
  readonly maskCard: Locator;
  readonly maskCards: Locator;
  readonly maskCardExpanded: Locator;
  readonly maskCardGeneratedEmail: Locator;
  readonly maskCardForwardedAmount: Locator;
  readonly maskCardDeleteButton: Locator;
  readonly maskCardCancelButton: Locator;
  readonly maskCardDeleteDialogModal: Locator;
  readonly maskCardDeleteDialogModalGeneratedEmail: Locator;
  readonly maskCardFinalDeleteButton: Locator;
  readonly maskList: Locator;
  readonly maxMaskLimitButton: Locator;
  readonly maxMaskBannerText: Locator;
  readonly generateNewMaskPremiumButton: Locator;
  readonly premiumRandomMask: Locator;
  readonly closeCornerUpsell: Locator;
  readonly closeCornerTips: Locator;
  readonly blockSegmentedControl: Locator;
  readonly blockPromotions: Locator;
  readonly blockAll: Locator;
  readonly blockLevelLabel: Locator;
  readonly blockLevelAllLabel: Locator;
  readonly blockLevelPromosLabel: Locator;
  readonly premiumDomainMask: Locator;
  readonly customMaskInput: Locator;
  readonly generateCustomMaskConfirm: Locator;
  readonly customMaskSuccessHeader: Locator;
  readonly customMaskDoneButton: Locator;
  readonly maskCardBottomMeta: Locator;
  readonly maskCardTrackersCount: Locator;
  readonly chooseSubdomain: Locator;
  readonly bannerEmailError: Locator;

  constructor(page: Page) {
    this.page = page;

    // dashboard header elements
    this.header = page.locator("div header").first();
    this.FAQButton = page.getByText("FAQ").first();
    this.newsButton = page.getByText("News");
    this.homeButton = page.getByRole("link", { name: "Email masks" });
    this.signOutButton = page.locator('button:has-text("Sign Out")').first();

    // dashboard elements
    this.upgradeButton = page.locator('a:has-text("Upgrade")').first();
    this.getMoreProtectionButton = page.locator(
      ':has-text("Get more protection")',
    );
    this.emailMasksUsedAmount = page.getByTestId("profile-masks-used").first();
    this.generateNewMaskButton = page.getByTitle("Generate new mask");
    this.generateNewMaskPremiumButton = page.locator(
      "button:has-text('Generate new mask')",
    );
    this.maxMaskLimitButton = page.getByText("Get unlimited email masks");
    this.maxMaskBannerText = page.getByTestId(
      "profile-upsell-banner-description",
    );
    this.premiumRandomMask = page.locator('//li[@data-key="random"]');
    this.premiumDomainMask = page.locator('//li[@data-key="custom"]');
    this.closeCornerUpsell = page.getByTestId(
      "corner-notification-close-button",
    );
    this.closeCornerTips = page.getByTestId("tips-close-button");
    this.relayExtensionBanner = page.locator(
      '//div[contains(@class, "is-hidden-with-addon")]',
    );
    this.dashBoardWithoutMasks = page.getByTestId("onboarding-wrapper");
    this.chooseSubdomain = page.locator("id=mpp-choose-subdomain");
    this.bannerEmailError = page.getByText(
      "The mask could not be created. Please try again.",
    );

    // mask card elements
    this.maskCard = page.getByRole("button", { name: "Generate new mask" });
    this.maskList = page.getByTestId("alias-list");
    this.maskCards = this.maskList.locator("li");
    this.maskCardExpanded = page.getByTestId("mask-card-expand");
    this.maskCardGeneratedEmail = this.maskCards
      .first()
      .getByTestId("mask-card-copy");
    this.maskCardBottomMeta = page.getByTestId("mask-card-meta");
    this.maskCardForwardedAmount = this.maskCards
      .first()
      .getByTestId("mask-card-forwarded-stat");
    this.maskCardTrackersCount = this.maskCards
      .first()
      .getByTestId("mask-card-trackers-removed-stat");
    this.maskCardDeleteButton = page.locator('button:has-text("Delete")');
    this.maskCardCancelButton = page.locator('button:has-text("Cancel")');
    this.maskCardDeleteDialogModal = page.getByTestId(
      "alias-deletion-button-permanent-dialog-wrapper",
    );
    this.maskCardDeleteDialogModalGeneratedEmail =
      this.maskCardDeleteDialogModal.locator("samp");
    this.maskCardFinalDeleteButton = page.getByTestId(
      "alias-deletion-button-permanent-button",
    );
    this.blockSegmentedControl = this.maskCards
      .first()
      .getByTestId("mask-card-block-level-segmented-control");
    this.blockPromotions = this.blockSegmentedControl
      .getByText("Promotions")
      .first();
    this.blockLevelLabel = this.maskCards
      .first()
      .getByTestId("mask-card-block-level-label");
    this.blockLevelPromosLabel = this.blockLevelLabel.getByText(
      "Blocking promo emails",
    );
    this.blockLevelAllLabel = this.blockLevelLabel.getByText(
      "Blocking all emails",
    );
    this.blockAll = this.blockSegmentedControl.getByText("All").first();
    this.customMaskInput = page.getByPlaceholder("Enter text");
    this.generateCustomMaskConfirm = page.getByRole("button", {
      name: "Generate mask",
    });
    this.customMaskSuccessHeader = page.getByRole("heading", {
      name: "Success!",
    });
    this.customMaskDoneButton = page.getByRole("button", { name: "Done" });
  }

  async open() {
    await this.page.goto("/accounts/profile/");
  }

  async skipOnboarding() {
    const onboardingElem = this.page.getByRole("button", { name: "Skip" });

    if (await onboardingElem.isVisible({ timeout: TIMEOUTS.LONG })) {
      await onboardingElem.click();
    }
  }

  async generatePremiumDomainMask(numberOfMasks = 1) {
    if (numberOfMasks === 0) {
      return;
    }
    // Check that the subdomain has been set for the premium user
    expect(await this.chooseSubdomain.count()).toBe(0);

    await this.generateNewMaskPremiumButton.click();
    await this.premiumDomainMask.click();

    await this.customMaskInput.fill(`${Date.now()}`);
    await this.generateCustomMaskConfirm.click();

    expect(await this.customMaskSuccessHeader.textContent()).toContain(
      "Success",
    );
    await this.customMaskDoneButton.click();
    await this.generatePremiumDomainMask(numberOfMasks - 1);
  }

  async generateMask(numberOfMasks = 1, isPremium = false) {
    // check if max number of masks have been created
    if (numberOfMasks === 0) {
      return;
    }
    const generateMaskBtn = isPremium
      ? this.generateNewMaskPremiumButton
      : this.generateNewMaskButton;

    const preMaskCardsCount = await this.maskCards.count();

    // generate a new mask
    await generateMaskBtn.click();

    // For premium, a dropdown appears. Wait briefly before checking.
    await this.premiumRandomMask
      .waitFor({ state: "visible", timeout: TIMEOUTS.SHORT })
      .catch(() => {});
    const randomMaskShown = await this.premiumRandomMask.isVisible();
    if (randomMaskShown) {
      await this.premiumRandomMask.click();
    }

    if (preMaskCardsCount === 0) {
      // Wait for the first mask card
      await expect(this.maskCards).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    } else {
      // Wait for the mask card count to increase, or the error banner
      await expect(
        this.bannerEmailError.or(this.maskCards.nth(preMaskCardsCount)),
      ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    }

    await expect(
      this.bannerEmailError,
      "No mask error banner. If fails, maybe rate-limited?",
    ).not.toBeVisible();
    await expect(this.maskCards, "Mask cards should go up by one").toHaveCount(
      preMaskCardsCount + 1,
    );

    // randomize between .5-1.0 secs between each generate to deal with issue of multiple quick clicks
    await this.page.waitForTimeout(Math.random() * 500 + 1000);
    if (await this.closeCornerUpsell.isVisible()) {
      await this.closeCornerUpsell.click();
    }
    await this.generateMask(numberOfMasks - 1, isPremium);
  }

  async upgrade() {
    await Promise.all([
      this.page.waitForURL(/.*\/accounts\/profile\/.*/),
      this.upgradeButton.click(),
    ]);
  }

  async maybeDeleteMasks(keepCount = 0) {
    // Wait for the Relay dashboard session to be established. Required for the
    // premium test flow, which calls this immediately after an FxA login before
    // the OAuth redirect back to Relay has completed.
    await this.page.waitForURL(/\/accounts\/profile\//, {
      timeout: TIMEOUTS.LONG,
    });

    // DRF SessionAuthentication requires X-CSRFToken on mutating requests.
    // Use browser fetch (via page.evaluate) so the Origin header is sent,
    // which Django's CSRF middleware requires on stage/prod.
    const [relayRes, domainRes] = await Promise.all([
      this.page.request.get("/api/v1/relayaddresses/"),
      this.page.request.get("/api/v1/domainaddresses/"),
    ]);

    const relayMasks: { id: number }[] = await relayRes.json();
    const domainMasks: { id: number }[] = await domainRes.json();

    const currentTotal = relayMasks.length + domainMasks.length;

    if (currentTotal > keepCount) {
      // Delete the excess in parallel. Relay addresses first since domain
      // addresses are premium-only and fewer in number.
      const urlsToDelete = [
        ...relayMasks.map((m) => `/api/v1/relayaddresses/${m.id}/`),
        ...domainMasks.map((m) => `/api/v1/domainaddresses/${m.id}/`),
      ].slice(0, currentTotal - keepCount);

      await this.page.evaluate(async (urls) => {
        const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
        await Promise.all(
          urls.map((url) =>
            fetch(url, {
              method: "DELETE",
              headers: { "X-CSRFToken": csrfToken },
              credentials: "same-origin",
            }),
          ),
        );
      }, urlsToDelete);
    } else if (currentTotal < keepCount) {
      // Create relay masks via API to fill up to keepCount.
      const masksToCreate = keepCount - currentTotal;
      await this.page.evaluate(async (count) => {
        const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
        await Promise.all(
          Array.from({ length: count }, () =>
            fetch("/api/v1/relayaddresses/", {
              method: "POST",
              headers: {
                "X-CSRFToken": csrfToken,
                "Content-Type": "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({}),
            }),
          ),
        );
      }, masksToCreate);
    }

    // Reload so the UI reflects the new API state, then dismiss onboarding
    // in case it reappears (e.g. after all masks are deleted).
    await this.page.reload();
    await this.page.waitForLoadState("networkidle");
    await this.skipOnboarding();
  }

  async generateOneRandomMask() {
    // reset data
    await this.open();
    await checkAuthState(this.page);
    await this.skipOnboarding();
    await this.maybeDeleteMasks();

    // create mask and use generated mask email to test email forwarding feature
    await this.generateMask(1);
    const generatedMaskEmail = await this.maskCardGeneratedEmail.textContent();

    return generatedMaskEmail;
  }

  async checkForwardedEmailCount(attempts = 10) {
    if (attempts === 0) {
      throw new Error("Email forwarded count did not update");
    }

    await this.forceRefresh();

    // check if card is expanded
    if (
      !(await this.page
        .getByRole("button", { expanded: true })
        .first()
        .isVisible())
    ) {
      await this.maskCardExpanded.first().click();
    }

    // check the forward emails count, if not 0, return the current value
    const forwardCount = await this.maskCardForwardedAmount.textContent();
    if (forwardCount !== "0") {
      return forwardCount;
    }

    return this.checkForwardedEmailCount(attempts - 1);
  }

  async setTrackersRemovalOpt() {
    await this.page.goto("/accounts/settings/");
    const trackersBox = this.page.locator("#tracker-removal");
    if (!(await trackersBox.isChecked())) {
      await trackersBox.check();
    }
    await this.page.getByRole("button", { name: "Save" }).click();
    await this.page
      .getByText("Your settings have been updated")
      .waitFor({ state: "attached", timeout: TIMEOUTS.MEDIUM });
    await this.page
      .locator("//button[starts-with(@class, 'Toastify__close-button')]")
      .click();
  }

  async signUpForPageWithTrackers(mask: string) {
    await this.page.goto(
      "https://pages.developmentthatpays.com/cheatsheets/scrum-kanban",
    );
    await this.page.getByPlaceholder("First Name").fill("relay-testing");
    await this.page.getByPlaceholder("Email Address").fill(mask);
    await this.page
      .getByRole("button", { name: "let me have that cheat sheet!" })
      .click();
    await this.page.waitForTimeout(TIMEOUTS.MEDIUM);
    const captchaShown = await this.page.isVisible(".seva-overlay");
    if (captchaShown) {
      throw new Error("Unable to continue test, captcha was shown");
    }
    await this.page
      .getByText("New to Agile? You NEED To See This!")
      .waitFor({ state: "attached", timeout: TIMEOUTS.MEDIUM });
    await this.open();
  }

  async forceRefresh() {
    // force a re-request of relayaddresses
    await this.FAQButton.click();
    await this.homeButton.click();
  }

  async checkTrackersCount(attempts = 10) {
    if (attempts === 0) {
      throw new Error("Email trackers count did not update");
    }

    await this.forceRefresh();

    // check if card is expanded
    if (
      !(await this.page
        .getByRole("button", { expanded: true })
        .first()
        .isVisible())
    ) {
      await this.maskCardExpanded.first().click();
    }

    // check the forward emails count, if not 0, return the current value
    const trackersCount = await this.maskCardTrackersCount.textContent();
    if (trackersCount !== "0") {
      return trackersCount;
    }

    this.page.waitForTimeout(TIMEOUTS.MEDIUM);
    return this.checkTrackersCount(attempts - 1);
  }
}
