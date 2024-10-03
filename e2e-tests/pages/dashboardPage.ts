import { Locator, Page, expect } from "@playwright/test";
import { checkAuthState } from "../e2eTestUtils/helpers";

export class DashboardPage {
  readonly page: Page;
  readonly header: Locator;
  readonly homeButton: Locator;
  readonly FAQButton: Locator;
  readonly newsButton: Locator;
  readonly userMenuPopUp: Locator;
  readonly userMenuLetter: Locator;
  readonly getMoreProtectionButton: Locator;
  readonly userMenuPopEmail: Locator;
  readonly upgradeButton: Locator;
  readonly upgradeNowButton: Locator;
  readonly userMenuButton: Locator;
  readonly signOutButton: Locator;
  readonly signOutToastAlert: Locator;
  readonly bottomUgradeBanner: Locator;
  readonly relayExtensionBanner: Locator;
  readonly dashBoardWithoutMasks: Locator;
  readonly dashBoardWithoutMasksEmail: Locator;
  readonly generateNewMaskButton: Locator;
  readonly emailsForwardedAmount: Locator;
  readonly emailsBlockedAmount: Locator;
  readonly emailMasksUsedAmount: Locator;
  readonly maskCard: Locator;
  readonly maskCardString: string;
  readonly maskCardExpanded: Locator;
  readonly maskCardExpandButton: Locator;
  readonly maskCardHeader: Locator;
  readonly maskCardGeneratedEmail: Locator;
  readonly maskCardForwardedAmount: Locator;
  readonly maskCardRepliesAmount: Locator;
  readonly maskCardBlockedAmount: Locator;
  readonly maskCardDeleteButton: Locator;
  readonly maskCardCancelButton: Locator;
  readonly dashboardPageWithoutHeader: Locator;
  readonly maskCardDeleteDialogModal: Locator;
  readonly maskCardDeleteDialogModalGeneratedEmail: Locator;
  readonly maskCardFinalDeleteButton: Locator;
  readonly maxMaskLimitButton: Locator;
  readonly maxMaskBannerText: Locator;
  readonly generateNewMaskPremiumButton: Locator;
  readonly premiumRandomMask: Locator;
  readonly closeCornerUpsell: Locator;
  readonly closeCornerTips: Locator;
  readonly blockPromotions: Locator;
  readonly blockAll: Locator;
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
    this.userMenuButton = page.locator(
      '//div[starts-with(@class, "UserMenu_wrapper")]',
    );
    this.userMenuPopUp = page.locator(
      '//ul[starts-with(@class, "UserMenu_popup")]',
    );
    this.userMenuLetter = page.locator(
      '//div[starts-with(@class, "UserMenu_wrapper")]',
    );
    this.userMenuPopEmail = page.locator(
      '//span[starts-with(@class, "UserMenu_account")]/b',
    );
    this.signOutButton = page.locator('button:has-text("Sign Out")').first();
    this.signOutToastAlert = page.locator(
      '//div[@class="Toastify__toast-body"]',
    );

    // dashboard elements
    this.upgradeNowButton = page.locator('a:has-text("Upgrade Now")');
    this.upgradeButton = page.locator('a:has-text("Upgrade")').first();
    this.getMoreProtectionButton = page.locator(
      ':has-text("Get more protection")',
    );
    this.dashboardPageWithoutHeader = page.locator(
      '//main[starts-with(@class, "profile_profile-wrapper")]',
    );
    this.emailsForwardedAmount = page.locator(
      '(//dd[starts-with(@class, "profile_value")])[3]',
    );
    this.emailsBlockedAmount = page.locator(
      '(//dd[starts-with(@class, "profile_value")])[2]',
    );
    this.emailMasksUsedAmount = page.locator(
      '(//dd[starts-with(@class, "profile_value")])[1]',
    );
    this.generateNewMaskButton = page.getByTitle("Generate new mask");
    this.generateNewMaskPremiumButton = page.locator(
      "button:has-text('Generate new mask')",
    );
    this.maxMaskLimitButton = page.getByText("Get unlimited email masks");
    this.maxMaskBannerText = page.locator(
      '//p[starts-with(@class, "profile_upsell-banner-description")]',
    );
    this.premiumRandomMask = page.locator('//li[@data-key="random"]');
    this.premiumDomainMask = page.locator('//li[@data-key="custom"]');
    this.closeCornerUpsell = page.locator(
      '//button[starts-with(@class, "CornerNotification_close-button")]',
    );
    this.closeCornerTips = page.locator(
      '//button[starts-with(@class, "Tips_close-button")]',
    );
    this.bottomUgradeBanner = page.locator(
      '//div[starts-with(@class, "profile_bottom-banner-wrapper")]',
    );
    this.relayExtensionBanner = page.locator(
      '//div[contains(@class, "is-hidden-with-addon")]',
    );
    this.dashBoardWithoutMasks = page.locator(
      '//section[starts-with(@class, "Onboarding_wrapper")]',
    );
    this.dashBoardWithoutMasksEmail = page.locator(
      '//section[starts-with(@class, "profile_no-premium-header")]',
    );
    this.chooseSubdomain = page.locator("id=mpp-choose-subdomain");
    this.bannerEmailError = page.getByText(
      "The mask could not be created. Please try again.",
    );

    // mask card elements
    this.maskCard = page.getByRole("button", { name: "Generate new mask" });
    this.maskCardString = '//div[starts-with(@class, "MaskCard_card")]';
    this.maskCardExpanded = page.locator(
      '//button[starts-with(@class, "MaskCard_expand")]',
    );
    this.maskCardExpandButton = page.locator(
      '//button[starts-with(@class, "MaskCard_expand")]',
    );
    this.maskCardHeader = page.locator(
      '//div[starts-with(@class, "MaskCard_summary")]',
    );
    this.maskCardGeneratedEmail = page
      .locator('//button[starts-with(@class, "MaskCard_copy")]/samp')
      .first();
    this.maskCardBottomMeta = page.locator(
      '//div[starts-with(@class, "MaskCard_meta")]',
    );
    this.maskCardForwardedAmount = page
      .locator('//div[contains(@class, "MaskCard_forwarded")]/dd')
      .first();
    this.maskCardTrackersCount = page
      .locator('//div[contains(@class, "MaskCard_trackers-removed-stat")]/dd')
      .first();
    this.maskCardRepliesAmount = page.locator(
      '(//span[contains(@class, "Alias_blocked-stat")])[2]',
    );
    this.maskCardBlockedAmount = page.locator(
      '(//span[contains(@class, "Alias_blocked-stat")])[1]',
    );
    this.maskCardDeleteButton = page.locator('button:has-text("Delete")');
    this.maskCardCancelButton = page.locator('button:has-text("Cancel")');
    this.maskCardDeleteDialogModal = page.locator(
      '//div[starts-with(@class, "AliasDeletionButtonPermanent_dialog-wrapper")]',
    );
    this.maskCardDeleteDialogModalGeneratedEmail = page.locator(
      '//div[starts-with(@class, "AliasDeletionButtonPermanent_dialog-wrapper")]//samp',
    );
    this.maskCardFinalDeleteButton = page.locator(
      '//button[contains(@class, "Button_is-destructive")]',
    );
    this.blockPromotions = page
      .locator(
        '//div[starts-with(@class, "MaskCard_block-level-segmented-control")]',
      )
      .first()
      .getByText("Promotions")
      .first();
    this.blockLevelPromosLabel = page
      .locator('//div[starts-with(@class, "MaskCard_block-level-label")]')
      .getByText("Blocking promo emails")
      .first();
    this.blockLevelAllLabel = page
      .locator('//div[starts-with(@class, "MaskCard_block-level-label")]')
      .getByText("Blocking all emails")
      .first();
    this.blockAll = page
      .locator(
        '//div[starts-with(@class, "MaskCard_block-level-segmented-control")]',
      )
      .first()
      .getByText("All")
      .first();
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

    if (await onboardingElem.isVisible({ timeout: 6000 })) {
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

    const maskCards = this.page.locator(this.maskCardString);
    const preMaskCardsCount = await maskCards.count();

    // generate a new mask
    await generateMaskBtn.click();

    const randomMaskShown = await this.premiumRandomMask.isVisible();
    if (randomMaskShown) {
      await this.premiumRandomMask.click();
    }

    if (preMaskCardsCount === 0) {
      // Wait for the first mask card
      expect(maskCards).toBeVisible({ timeout: 3000 });
    } else {
      // Wait for the mask card count to increase, or the error banner
      expect(
        this.bannerEmailError.or(maskCards.nth(preMaskCardsCount)),
      ).toBeVisible({ timeout: 3000 });
    }

    expect(
      this.bannerEmailError,
      "No mask error banner. If fails, maybe rate-limited?",
    ).not.toBeVisible();
    expect(await maskCards, "Mask cards should go up by one").toHaveCount(
      preMaskCardsCount + 1,
    );

    // randomize between .5-1.0 secs between each generate to deal with issue of multiple quick clicks
    await this.page.waitForTimeout(Math.random() * 500 + 500);
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

  async upgradeNow() {
    await Promise.all([this.upgradeNowButton.click()]);
  }

  async maybeDeleteMasks(clearAll = true, numberOfMasks = 1) {
    let isExpanded = false;

    try {
      numberOfMasks = await this.page.locator(this.maskCardString).count();
    } catch (err) {
      numberOfMasks = 0;
    }

    if (await this.closeCornerUpsell.isVisible()) {
      await this.closeCornerUpsell.click();
    }

    if (await this.closeCornerTips.isVisible()) {
      await this.closeCornerTips.click();
    }

    // check number of masks available
    if (numberOfMasks === 0) {
      return;
    }

    // if clear all, check if there's an expanded mask card
    if (clearAll) {
      try {
        await this.page.waitForSelector(this.maskCardString, { timeout: 3000 });
      } catch (error) {
        console.error("There are no masks to delete");
        return;
      }

      try {
        isExpanded = await this.page
          .getByRole("button", { expanded: true })
          .first()
          .isVisible();
      } catch {}
    }

    // locate mask expand button only if mask is not already expanded
    if (numberOfMasks && !isExpanded) {
      try {
        await this.maskCardExpanded.first().click();
      } catch {}
    }

    // delete flow
    if (numberOfMasks) {
      const currentMaskCardDeleteButton = this.page
        .locator('button:has-text("Delete")')
        .first();
      await currentMaskCardDeleteButton.click();
      await this.maskCardFinalDeleteButton.click();
    }

    // wait for 500 ms and run flow again with the next masks
    await this.page.waitForTimeout(500);
    await this.maybeDeleteMasks(true, numberOfMasks - 1);
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
      .waitFor({ state: "attached", timeout: 3000 });
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
    await this.page.waitForTimeout(5000);
    const captchaShown = await this.page.isVisible(".seva-overlay");
    if (captchaShown) {
      throw new Error("Unable to continue test, captcha was shown");
    }
    await this.page
      .getByText("New to Agile? You NEED To See This!")
      .waitFor({ state: "attached", timeout: 3000 });
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

    this.page.waitForTimeout(500);
    return this.checkTrackersCount(attempts - 1);
  }
}
