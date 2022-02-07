import { NextPage } from "next";
import { Localized, useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./premium.module.scss";
import PerkIllustrationUnlimited from "../../../static/images/premium-promo/illustration-unlimited.svg";
import PerkIllustrationCustomDomain from "../../../static/images/premium-promo/illustration-custom-domain.svg";
import PerkIllustrationDashboard from "../../../static/images/premium-promo/illustration-dashboard.svg";
import ShoppingIllustration from "../../../static/images/use-case-shopping.svg";
import SocialNetworksIllustration from "../../../static/images/use-case-social-networks.svg";
import GamingIllustration from "../../../static/images/use-case-gaming.svg";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { Button, LinkButton } from "../components/Button";
import { DemoPhone } from "../components/landing/DemoPhone";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { Carousel } from "../components/landing/Carousel";
import { Plans } from "../components/landing/Plans";
import {
  getPlan,
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../functions/getPlan";
import { trackPurchaseStart } from "../functions/trackPurchase";

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
    <section id="pricing" className={styles.plansWrapper}>
      <div className={styles.plans}>
        <div className={styles.planComparison}>
          <Plans premiumCountriesData={runtimeData.data} />
        </div>
        <div className={styles.callout}>
          <h2>
            {l10n.getString("landing-pricing-headline", {
              monthly_price: getPlan(runtimeData.data).price,
            })}
          </h2>
          <p>{l10n.getString("landing-pricing-body")}</p>
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
      title={l10n.getString("premium-promo-availability-warning")}
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
              id="premium-promo-hero-body-html"
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
            <p>{l10n.getString("premium-promo-availability-warning")}</p>
          </div>
          <div className={styles.demoPhone}>
            <DemoPhone
              premium={
                runtimeData.data?.PREMIUM_PLANS.premium_available_in_country ===
                true
              }
            />
          </div>
        </section>
        <section id="perks" className={styles.perksWrapper}>
          <div className={styles.perks}>
            <h2 className={styles.headline}>
              {l10n.getString("premium-promo-perks-headline")}
            </h2>
            <p className={styles.lead}>
              {l10n.getString("premium-promo-perks-lead")}
            </p>
            <div className={styles.perk}>
              <img src={PerkIllustrationUnlimited.src} alt="" />
              <div className={styles.description}>
                <h3>
                  {l10n.getString(
                    "premium-promo-perks-perk-unlimited-headline"
                  )}
                </h3>
                <p>
                  {l10n.getString("premium-promo-perks-perk-unlimited-body")}
                </p>
                {getPerkCta("premium-promo-perk-unlimited-cta")}
              </div>
            </div>
            <div className={styles.perk}>
              <img src={PerkIllustrationCustomDomain.src} alt="" />
              <div className={styles.description}>
                <h3>
                  {l10n.getString(
                    "premium-promo-perks-perk-custom-domain-headline"
                  )}
                </h3>
                <p>
                  {l10n.getString(
                    "premium-promo-perks-perk-custom-domain-body"
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
                    "premium-promo-perks-perk-dashboard-headline"
                  )}
                </h3>
                <p>
                  {l10n.getString("premium-promo-perks-perk-dashboard-body")}
                </p>
                {getPerkCta("premium-promo-perk-dashboard-cta")}
              </div>
            </div>
          </div>
        </section>
        <section id="use-cases" className={styles.useCasesWrapper}>
          <div className={styles.useCases}>
            <h2 className={styles.headline}>
              {l10n.getString("premium-promo-use-cases-headline")}
            </h2>
            <Carousel
              title={l10n.getString("premium-promo-use-cases-headline")}
              tabs={[
                {
                  color: "yellow",
                  heading: l10n.getString(
                    "premium-promo-use-cases-shopping-heading"
                  ),
                  content: l10n.getString(
                    "premium-promo-use-cases-shopping-body"
                  ),
                  illustration: ShoppingIllustration,
                  id: "use-cases/shopping",
                },
                {
                  color: "orange",
                  heading: l10n.getString(
                    "premium-promo-use-cases-social-networks-heading"
                  ),
                  content: l10n.getString(
                    "premium-promo-use-cases-social-networks-body"
                  ),
                  illustration: SocialNetworksIllustration,
                  id: "use-cases/social-networks",
                },
                {
                  color: "pink",
                  heading: l10n.getString(
                    "premium-promo-use-cases-gaming-heading"
                  ),
                  content: l10n.getString(
                    "premium-promo-use-cases-gaming-body"
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
