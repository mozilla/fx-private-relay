import { NextPage } from "next";
import { event as gaEvent } from "react-ga";
import styles from "./premium.module.scss";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { LinkButton } from "../components/Button";
import { DemoPhone } from "../components/landing/DemoPhone";
import { useRuntimeData } from "../hooks/api/runtimeData";
import {
  isBundleAvailableInCountry,
  isPeriodicalPremiumAvailableInCountry,
} from "../functions/getPlan";
import { PlanMatrix } from "../components/landing/PlanMatrix";
import { BundleBanner } from "../components/landing/BundleBanner";
import { useFlaggedAnchorLinks } from "../hooks/flaggedAnchorLinks";
import { useL10n } from "../hooks/l10n";
import { Localized } from "../components/Localized";
import { HighlightedFeatures } from "../components/landing/HighlightedFeatures";

const PremiumPromo: NextPage = () => {
  const l10n = useL10n();
  const runtimeData = useRuntimeData();
  useFlaggedAnchorLinks([runtimeData.data]);
  const heroCtaRef = useGaViewPing({
    category: "Purchase Button",
    label: "premium-promo-cta",
  });

  const cta = isPeriodicalPremiumAvailableInCountry(runtimeData.data) ? (
    <LinkButton
      ref={heroCtaRef}
      href="#pricing"
      onClick={() => {
        gaEvent({
          category: "Purchase Button",
          action: "Engage",
          label: "home-hero-cta",
        });
      }}
    >
      {l10n.getString("premium-promo-hero-cta")}
    </LinkButton>
  ) : (
    <LinkButton
      href="/premium/waitlist"
      title={l10n.getString("premium-promo-availability-warning-2")}
    >
      {l10n.getString("waitlist-submit-label-2")}
    </LinkButton>
  );

  return (
    <Layout theme="premium" runtimeData={runtimeData.data}>
      <main>
        <section id="hero" className={styles.hero}>
          <div className={styles.lead}>
            <h2>{l10n.getString("premium-promo-hero-headline")}</h2>
            <Localized id="premium-promo-hero-body-3">
              <p />
            </Localized>
            {cta}
            <p>{l10n.getString("premium-promo-availability-warning-2")}</p>
          </div>
          <div className={styles["demo-phone"]}>
            <DemoPhone
              premium={isPeriodicalPremiumAvailableInCountry(runtimeData.data)}
            />
          </div>
        </section>

        {isBundleAvailableInCountry(runtimeData.data) && (
          <section id="vpn_promo" className={styles["bundle-banner-section"]}>
            <BundleBanner runtimeData={runtimeData.data} />
          </section>
        )}

        <section id="perks" className={styles["perks-wrapper"]}>
          <HighlightedFeatures />
        </section>

        <section className={styles["plans-wrapper"]}>
          <div className={styles.plans}>
            <PlanMatrix runtimeData={runtimeData.data} />
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default PremiumPromo;
