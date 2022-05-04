import { NextPage } from "next";
import { Localized, useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./premium.module.scss";
import PerkIllustrationUnlimited from "../../public/images/perk-unlimited.svg";
import PerkIllustrationCustomDomain from "../../public/images/perk-custom-domain.svg";
import PerkIllustrationDashboard from "../../public/images/perk-dashboard.svg";
import ShoppingIllustration from "../../public/images/use-case-shopping.svg";
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
import { Button, LinkButton } from "../components/Button";
import { DemoPhone } from "../components/landing/DemoPhone";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { Carousel } from "../components/landing/carousel/Carousel";
import { CarouselContentTextOnly } from "../components/landing/carousel/ContentTextOnly";
import { Plans } from "../components/landing/Plans";
import {
  getPlan,
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../functions/getPlan";
import { trackPurchaseStart } from "../functions/trackPurchase";
import { CarouselContentHero } from "../components/landing/carousel/ContentHero";
import ShoppingHero from "../components/landing/carousel/images/shopping-hero.svg";
import { CarouselContentCards } from "../components/landing/carousel/ContentCards";
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
  };

  const purchase = () => {
    gaEvent({
      category: "Purchase Button",
      action: "Engage",
      label: "home-hero-cta",
    });
  };

  const plansSection = isPremiumAvailableInCountry(runtimeData.data) ? (
    <section id="pricing" className={styles["plans-wrapper"]}>
      <div className={styles.plans}>
        <div className={styles["plan-comparison"]}>
          <Plans premiumCountriesData={runtimeData.data} />
        </div>
        <div className={styles.callout}>
          <h2>
            {l10n.getString("landing-pricing-headline-2", {
              monthly_price: getPlan(runtimeData.data).price,
            })}
          </h2>
          <p>{l10n.getString("landing-pricing-body-2")}</p>
        </div>
      </div>
    </section>
  ) : null;

  const cta = isPremiumAvailableInCountry(runtimeData.data) ? (
    <LinkButton
      ref={heroCtaRef}
      href={getPremiumSubscribeLink(runtimeData.data)}
      onClick={() => purchase()}
    >
      {l10n.getString("premium-promo-hero-cta")}
    </LinkButton>
  ) : (
    <Button
      disabled={true}
      title={l10n.getString("premium-promo-availability-warning-2")}
    >
      {l10n.getString("premium-promo-hero-cta")}
    </Button>
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
    <Layout theme="premium">
      <main>
        <section id="hero" className={styles.hero}>
          <div className={styles.lead}>
            <h2>{l10n.getString("premium-promo-hero-headline")}</h2>
            <Localized
              id="premium-promo-hero-body-2-html"
              vars={{
                monthly_price: isPremiumAvailableInCountry(runtimeData.data)
                  ? getPlan(runtimeData.data).price
                  : runtimeData.data?.PREMIUM_PLANS.plan_country_lang_mapping.us
                      .en.price ?? "&hellip;",
              }}
              elems={{
                b: <b />,
              }}
            >
              <p />
            </Localized>
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
