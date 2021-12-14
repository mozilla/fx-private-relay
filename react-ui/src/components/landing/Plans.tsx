import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./Plans.module.scss";
import RelayWordmark from "../../../../static/images/logos/logo-firefox-relay.svg";
import RelayPremiumWordmark from "../../../../static/images/logos/logo-firefox-premium-relay.svg";
import { useGaPing } from "../../hooks/gaPing";
import {
  getPlan,
  getPremiumSubscribeLink,
  PremiumCountriesDataWithPremiumAvailable,
} from "../../functions/getPlan";
import { trackPurchaseStart } from "../../functions/trackPurchase";

export type Props = {
  premiumCountriesData: PremiumCountriesDataWithPremiumAvailable;
};

export const Plans = (props: Props) => {
  const { l10n } = useLocalization();
  const freeFauxButtonRef = useGaPing({
    category: "Sign In",
    label: "landing-pricing-free-cta",
  });
  const premiumFauxButtonRef = useGaPing({
    category: "Purchase Button",
    label: "newlanding-plans-button",
  });

  return (
    <div className={styles.comparison}>
      {/* TODO: Add login URL */}
      <a
        href="#"
        className={`${styles.plan} ${styles.freePlan}`}
        onClick={() =>
          gaEvent({
            category: "Sign In",
            action: "Engage",
            label: "landing-pricing-free-cta",
          })
        }
      >
        <img
          src={RelayWordmark.src}
          alt="Firefox Relay"
          className={styles.wordMark}
        />
        <b className={styles.price}>
          {l10n.getString("landing-pricing-free-price")}
        </b>
        <ul className={styles.features}>
          <li>{l10n.getString("landing-pricing-free-feature-1")}</li>
          <li>{l10n.getString("landing-pricing-free-feature-2")}</li>
        </ul>
        <div ref={freeFauxButtonRef} className={styles.fauxButton}>
          {l10n.getString("landing-pricing-free-cta")}
        </div>
      </a>
      <span className={styles.callout}>
        {l10n.getString("landing-pricing-premium-price-highlight")}
      </span>
      <a
        href={getPremiumSubscribeLink(props.premiumCountriesData)}
        onClick={() => trackPurchaseStart()}
        className={`${styles.plan} ${styles.premiumPlan}`}
      >
        <img
          src={RelayPremiumWordmark.src}
          alt="Firefox Relay Premium"
          className={styles.wordMark}
        />
        <b className={styles.price}>
          {l10n.getString("landing-pricing-premium-price", {
            monthly_price: getPlan(props.premiumCountriesData).price,
          })}
        </b>
        <ul className={styles.features}>
          <li>{l10n.getString("landing-pricing-premium-feature-1")}</li>
          <li>{l10n.getString("landing-pricing-premium-feature-2")}</li>
          <li>{l10n.getString("landing-pricing-premium-feature-3")}</li>
          <li>{l10n.getString("landing-pricing-premium-feature-4")}</li>
        </ul>
        <div ref={premiumFauxButtonRef} className={styles.fauxButton}>
          {l10n.getString("nav-profile-sign-up")}
        </div>
      </a>
    </div>
  );
};
