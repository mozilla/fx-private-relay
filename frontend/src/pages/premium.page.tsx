import { NextPage } from "next";
import { useState } from "react";
import { Localized, useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./premium.module.scss";
import PerkIllustrationUnlimited from "../../public/images/perk-unlimited.svg";
import PerkIllustrationCustomDomain from "../../public/images/perk-custom-domain.svg";
import PerkIllustrationDashboard from "../../public/images/perk-dashboard.svg";
import ShoppingIllustration from "../../public/images/use-case-shopping.svg";
import PerkIllustrationBlockPromotionals from "../../public/images/perk-block-promotionals.svg";
import PerkIllustrationTrackerBlocking from "../../public/images/perk-tracker-blocking.svg";
import SocialNetworksIllustration from "../../public/images/use-case-social-networks.svg";
import GamingIllustration from "../../public/images/use-case-gaming.svg";
import OfflineIllustration from "../../public/images/use-case-offline.svg";
import AccessContentIllustration from "../../public/images/use-case-access-content.svg";
import SignupsHero from "../components/landing/carousel/images/signups-hero.svg";
import OnTheGoConnect from "../components/landing/carousel/images/onthego-illustration-connect.svg";
import OnTheGoPhone from "../components/landing/carousel/images/onthego-illustration-phone.svg";
import OnTheGoReceipt from "../components/landing/carousel/images/onthego-illustration-receipts.svg";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { LinkButton } from "../components/Button";
import { DemoPhone } from "../components/landing/DemoPhone";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { Carousel } from "../components/landing/carousel/Carousel";
import { CarouselContentTextOnly } from "../components/landing/carousel/ContentTextOnly";
import { Plans } from "../components/landing/Plans";
import {
  getPremiumPlan,
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../functions/getPlan";
import { trackPurchaseStart } from "../functions/trackPurchase";
import { CarouselContentHero } from "../components/landing/carousel/ContentHero";
import ShoppingHero from "../components/landing/carousel/images/shopping-hero.svg";
import { CarouselContentCards } from "../components/landing/carousel/ContentCards";
import { isFlagActive } from "../functions/waffle";
import { getLocale } from "../functions/getLocale";
import { useInterval } from "../hooks/interval";
import { CountdownTimer } from "../components/CountdownTimer";
import { parseDate } from "../functions/parseDate";

const PremiumPromo: NextPage = () => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();
  const heroCtaRef = useGaViewPing({
    category: "Purchase Button",
    label: "premium-promo-cta",
  });
  const perkCtaRefs = {
    "premium-promo-perk-unlimited-cta": useGaViewPing({
      category: "Purchase Button",
      label: "premium-promo-perk-unlimited-cta",
    }),
    "premium-promo-perk-custom-domain-cta": useGaViewPing({
      category: "Purchase Button",
      label: "premium-promo-perk-custom-domain-cta",
    }),
    "premium-promo-perk-dashboard-cta": useGaViewPing({
      category: "Purchase Button",
      label: "premium-promo-perk-dashboard-cta",
    }),
    "premium-promo-perk-block-promotionals-cta": useGaViewPing({
      category: "Purchase Button",
      label: "premium-promo-perk-block-promotionals-cta",
    }),
    "premium-promo-perk-tracker-blocking-cta": useGaViewPing({
      category: "Purchase Button",
      label: "premium-promo-perk-tracker-blocking-cta",
    }),
  };

  const heroCountdownCtaRef = useGaViewPing({
    category: "Purchase Button",
    label: "Interstitial Page: Top Banner",
  });
  const plansCountdownCtaRef = useGaViewPing({
    category: "Purchase Button",
    label: "Interstitial Page: Bottom Banner",
  });

  const [now, setNow] = useState(Date.now());
  const endDateFormatter = new Intl.DateTimeFormat(getLocale(l10n), {
    dateStyle: "long",
  });

  useInterval(() => {
    setNow(Date.now());
  }, 1000);

  const introPricingOfferEndDate = runtimeData.data
    ? parseDate(runtimeData.data.INTRO_PRICING_END)
    : new Date(0);
  const remainingTimeInMs = introPricingOfferEndDate.getTime() - now;

  const plansSection =
    // Show the countdown timer to the end of our introductory pricing offer if…
    // …the offer hasn't expired yet,
    remainingTimeInMs > 0 &&
    // …the remaining time isn't far enough in the future that the user's
    // computer's clock is likely to be wrong,
    remainingTimeInMs <= 32 * 24 * 60 * 60 * 1000 &&
    // …the user is able to purchase Premium at the introductory offer price, and
    isPremiumAvailableInCountry(runtimeData.data) &&
    // …the relevant feature flag is enabled:
    isFlagActive(runtimeData.data, "intro_pricing_countdown") ? (
      <section id="pricing" className={styles["plans-wrapper"]}>
        <div className={styles.plans}>
          <div className={styles["plan-comparison"]}>
            <Plans runtimeData={runtimeData.data} />
          </div>
          <div className={styles.callout}>
            <h2>
              {l10n.getString("premium-promo-pricing-offer-end-headline", {
                monthly_price: getPremiumPlan(runtimeData.data).price,
              })}
            </h2>
            <div
              className={styles["end-of-intro-pricing-countdown-and-warning"]}
            >
              <b>{l10n.getString("premium-promo-pricing-offer-end-warning")}</b>
              <CountdownTimer remainingTimeInMs={remainingTimeInMs} />
            </div>
            <LinkButton
              ref={plansCountdownCtaRef}
              href={getPremiumSubscribeLink(runtimeData.data)}
              onClick={() => {
                gaEvent({
                  category: "Purchase Button",
                  action: "Engage",
                  label: "Interstitial Page: Bottom Banner",
                });
              }}
            >
              {l10n.getString("premium-promo-pricing-offer-end-cta")}
            </LinkButton>
            <p>
              {l10n.getString("premium-promo-pricing-offer-end-body", {
                end_date: endDateFormatter.format(introPricingOfferEndDate),
              })}
            </p>
          </div>
        </div>
      </section>
    ) : // Otherwise, if Premium is available in the user's country,
    // allow them to purchase it:
    isPremiumAvailableInCountry(runtimeData.data) ? (
      <section id="pricing" className={styles["plans-wrapper"]}>
        <div className={styles.plans}>
          <div className={styles["plan-comparison"]}>
            <Plans runtimeData={runtimeData.data} />
          </div>
          <div className={styles.callout}>
            <h2>
              {l10n.getString("landing-pricing-headline-2", {
                monthly_price: getPremiumPlan(runtimeData.data).price,
              })}
            </h2>
            <p>{l10n.getString("landing-pricing-body-2")}</p>
          </div>
        </div>
      </section>
    ) : (
      // Or finally, if Premium is not available in the country,
      // prompt them to join the waitlist:
      <section id="pricing" className={styles["plans-wrapper"]}>
        <div className={`${styles.plans} ${styles["non-premium-country"]}`}>
          <Plans runtimeData={runtimeData.data} />
        </div>
      </section>
    );

  // Only show the countdown timer to the end of our introductory pricing offer if…
  const introPricingEndBanner =
    // …the offer hasn't expired yet,
    remainingTimeInMs > 0 &&
    // …the remaining time isn't far enough in the future that the user's
    // computer's clock is likely to be wrong,
    remainingTimeInMs <= 32 * 24 * 60 * 60 * 1000 &&
    // …the user is able to purchase Premium at the introductory offer price, and
    isPremiumAvailableInCountry(runtimeData.data) &&
    // …the relevant feature flag is enabled:
    isFlagActive(runtimeData.data, "intro_pricing_countdown") ? (
      <div className={styles["end-of-intro-pricing-hero"]}>
        <CountdownTimer remainingTimeInMs={remainingTimeInMs} />
        <div>
          <h3>{l10n.getString("premium-promo-offer-end-hero-heading")}</h3>
          <p>
            {l10n.getString("premium-promo-offer-end-hero-content", {
              end_date: endDateFormatter.format(introPricingOfferEndDate),
            })}
          </p>
        </div>
      </div>
    ) : null;

  const cta = isPremiumAvailableInCountry(runtimeData.data) ? (
    <LinkButton
      ref={introPricingEndBanner === null ? heroCtaRef : heroCountdownCtaRef}
      href={getPremiumSubscribeLink(runtimeData.data)}
      onClick={() => {
        gaEvent({
          category: "Purchase Button",
          action: "Engage",
          label:
            introPricingEndBanner === null
              ? "home-hero-cta"
              : "Interstitial Page: Top Banner",
        });
      }}
    >
      {l10n.getString(
        introPricingEndBanner === null
          ? "premium-promo-hero-cta"
          : "premium-promo-offer-end-hero-cta"
      )}
    </LinkButton>
  ) : (
    <LinkButton
      href="/premium/waitlist"
      title={l10n.getString("premium-promo-availability-warning-2")}
    >
      {l10n.getString("waitlist-submit-label")}
    </LinkButton>
  );

  const getPerkCta = (label: keyof typeof perkCtaRefs) => {
    if (!isPremiumAvailableInCountry(runtimeData.data)) {
      return null;
    }
    return (
      <LinkButton
        ref={perkCtaRefs[label]}
        onClick={() => trackPurchaseStart({ label: label })}
        href={getPremiumSubscribeLink(runtimeData.data)}
        title={l10n.getString("premium-promo-perks-cta-tooltip")}
      >
        {l10n.getString("premium-promo-perks-cta-label")}
      </LinkButton>
    );
  };

  return (
    <Layout theme="premium" runtimeData={runtimeData.data}>
      <main>
        <section id="hero" className={styles.hero}>
          <div className={styles.lead}>
            <h2>{l10n.getString("premium-promo-hero-headline")}</h2>
            <Localized
              id="premium-promo-hero-body-3"
              vars={{
                monthly_price: isPremiumAvailableInCountry(runtimeData.data)
                  ? getPremiumPlan(runtimeData.data).price
                  : runtimeData.data?.PREMIUM_PLANS.plan_country_lang_mapping.us
                      .en.price ?? "&hellip;",
              }}
            >
              <p />
            </Localized>
            {introPricingEndBanner}
            {cta}
            <p>{l10n.getString("premium-promo-availability-warning-2")}</p>
          </div>
          <div className={styles["demo-phone"]}>
            <DemoPhone
              premium={
                runtimeData.data?.PREMIUM_PLANS.premium_available_in_country ===
                true
              }
            />
          </div>
        </section>
        <section id="perks" className={styles["perks-wrapper"]}>
          <div className={styles.perks}>
            <h2 className={styles.headline}>
              {l10n.getString("premium-promo-perks-headline")}
            </h2>
            <p className={styles.lead}>
              {l10n.getString("premium-promo-perks-lead-2")}
            </p>
            <div className={styles.perk}>
              <img src={PerkIllustrationUnlimited.src} alt="" />
              <div className={styles.description}>
                <h3>
                  {l10n.getString(
                    "premium-promo-perks-perk-unlimited-headline-2"
                  )}
                </h3>
                <p>
                  {l10n.getString("premium-promo-perks-perk-unlimited-body-2")}
                </p>
                {getPerkCta("premium-promo-perk-unlimited-cta")}
              </div>
            </div>
            <div className={styles.perk}>
              <img src={PerkIllustrationCustomDomain.src} alt="" />
              <div className={styles.description}>
                <h3>
                  {l10n.getString(
                    "premium-promo-perks-perk-custom-domain-headline-2"
                  )}
                </h3>
                <p>
                  {l10n.getString(
                    "premium-promo-perks-perk-custom-domain-body-2"
                  )}
                </p>
                {getPerkCta("premium-promo-perk-custom-domain-cta")}
              </div>
            </div>
            <div className={styles.perk}>
              <img src={PerkIllustrationDashboard.src} alt="" />
              <div className={styles.description}>
                <h3>
                  {l10n.getString(
                    "premium-promo-perks-perk-dashboard-headline-2"
                  )}
                </h3>
                <p>
                  {l10n.getString("premium-promo-perks-perk-dashboard-body-2")}
                </p>
                {getPerkCta("premium-promo-perk-dashboard-cta")}
              </div>
            </div>
            <div className={styles.perk}>
              <img src={PerkIllustrationBlockPromotionals.src} alt="" />
              <div className={styles.description}>
                <b className={styles.pill}>
                  {l10n.getString("premium-promo-perks-pill-new")}
                </b>
                <h3>
                  {l10n.getString(
                    "premium-promo-perks-perk-block-promotionals-headline"
                  )}
                </h3>
                <p>
                  {l10n.getString(
                    "premium-promo-perks-perk-block-promotionals-body"
                  )}
                </p>
                {getPerkCta("premium-promo-perk-block-promotionals-cta")}
              </div>
            </div>
            {isFlagActive(runtimeData.data, "tracker_removal") ? (
              <div className={styles.perk}>
                <img src={PerkIllustrationTrackerBlocking.src} alt="" />
                <div className={styles.description}>
                  <b className={styles.pill}>
                    {l10n.getString("premium-promo-perks-pill-new")}
                  </b>
                  <h3>
                    {l10n.getString(
                      "premium-promo-perks-perk-tracker-blocking-headline"
                    )}
                  </h3>
                  <p>
                    {l10n.getString(
                      "premium-promo-perks-perk-tracker-blocking-body"
                    )}
                  </p>
                  {getPerkCta("premium-promo-perk-tracker-blocking-cta")}
                </div>
              </div>
            ) : null}
          </div>
        </section>
        <section id="use-cases" className={styles["use-cases-wrapper"]}>
          <div className={styles["use-cases"]}>
            <h2 className={styles.headline}>
              {l10n.getString("premium-promo-use-cases-headline-2")}
            </h2>
            <Carousel
              title={l10n.getString("landing-use-cases-heading")}
              tabs={[
                {
                  color: "yellow",
                  heading: l10n.getString("landing-use-cases-shopping"),
                  content: (
                    <CarouselContentHero
                      heroImage={ShoppingHero.src}
                      heading={l10n.getString(
                        "landing-use-cases-shopping-hero-heading"
                      )}
                      body={
                        <>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-shopping-hero-content1"
                            )}
                          </p>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-shopping-hero-content2"
                            )}
                          </p>
                        </>
                      }
                      textFirst={true}
                    />
                  ),
                  illustration: ShoppingIllustration,
                  id: "use-cases/shopping",
                },
                {
                  color: "deep-pink",
                  heading: l10n.getString("landing-use-cases-social-networks"),
                  content: (
                    <CarouselContentTextOnly
                      heading={l10n.getString(
                        "landing-use-cases-social-networks"
                      )}
                      body={l10n.getString(
                        "landing-use-cases-social-networks-body-2"
                      )}
                    />
                  ),
                  illustration: SocialNetworksIllustration,
                  id: "use-cases/social-networks",
                },
                {
                  color: "purple",
                  heading: l10n.getString("landing-use-cases-on-the-go"),
                  content: (
                    <CarouselContentCards
                      heading={l10n.getString(
                        "landing-use-cases-on-the-go-heading"
                      )}
                      lead={l10n.getString("landing-use-cases-on-the-go-lead")}
                      cards={[
                        {
                          image: OnTheGoConnect.src,
                          heading: l10n.getString(
                            "landing-use-cases-on-the-go-connect-heading"
                          ),
                          body: l10n.getString(
                            "landing-use-cases-on-the-go-connect-body"
                          ),
                        },
                        {
                          image: OnTheGoReceipt.src,
                          heading: l10n.getString(
                            "landing-use-cases-on-the-go-receipt-heading"
                          ),
                          body: l10n.getString(
                            "landing-use-cases-on-the-go-receipt-body"
                          ),
                        },
                        {
                          image: OnTheGoPhone.src,
                          heading: l10n.getString(
                            "landing-use-cases-on-the-go-phone-heading"
                          ),
                          body: l10n.getString(
                            "landing-use-cases-on-the-go-phone-body"
                          ),
                        },
                      ]}
                    />
                  ),
                  illustration: OfflineIllustration,
                  id: "use-cases/offline",
                },
                {
                  color: "pink",
                  heading: l10n.getString("landing-use-cases-signups"),
                  content: (
                    <CarouselContentHero
                      heroImage={SignupsHero.src}
                      heading={l10n.getString(
                        "landing-use-cases-signups-hero-heading"
                      )}
                      body={
                        <>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-signups-hero-content1"
                            )}
                          </p>
                          <p>
                            {l10n.getString(
                              "landing-use-cases-signups-hero-content2"
                            )}
                          </p>
                        </>
                      }
                      textFirst={false}
                    />
                  ),
                  illustration: AccessContentIllustration,
                  id: "use-cases/access-content",
                },
                {
                  color: "orange",
                  heading: l10n.getString("landing-use-cases-gaming"),
                  content: (
                    <CarouselContentTextOnly
                      heading={l10n.getString("landing-use-cases-gaming")}
                      body={l10n.getString("landing-use-cases-gaming-body-2")}
                    />
                  ),
                  illustration: GamingIllustration,
                  id: "use-cases/gaming",
                },
              ]}
            />
          </div>
        </section>
        {plansSection}
      </main>
    </Layout>
  );
};

export default PremiumPromo;
