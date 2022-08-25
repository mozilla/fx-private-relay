import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./Plans.module.scss";
import RelayWordmark from "./images/logo-firefox-relay.svg";
import RelayPremiumWordmark from "./images/logo-firefox-premium-relay.svg";
import { useGaViewPing } from "../../hooks/gaViewPing";
import {
  getPlan,
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../../functions/getPlan";
import { trackPurchaseStart } from "../../functions/trackPurchase";
import { getRuntimeConfig } from "../../config";
import Link from "next/link";
import { isFlagActive } from "../../functions/waffle";
import { RuntimeData } from "../../hooks/api/runtimeData";

export type Props = {
  runtimeData?: RuntimeData;
};

/**
 * Cards to compare and choose between the different plans available to the user.
 */
export const Plans = (props: Props) => {
  const { l10n } = useLocalization();
  const freeFauxButtonRef = useGaViewPing({
    category: "Sign In",
    label: "landing-pricing-free-cta",
  });
  const premiumFauxButtonRef = useGaViewPing({
    category: "Purchase Button",
    label: "newlanding-plans-button",
  });

  /** List of premium features **/
  const trackerBlockingFeatureListingPremium = isFlagActive(
    props.runtimeData,
    "tracker_removal"
  ) ? (
    <li>{l10n.getString("landing-pricing-premium-feature-6")}</li>
  ) : null;
  const premiumFeatures = (
    <ul className={styles.features}>
      <li>{l10n.getString("landing-pricing-premium-feature-1-2")}</li>
      <li>{l10n.getString("landing-pricing-premium-feature-2")}</li>
      <li>{l10n.getString("landing-pricing-premium-feature-3-2")}</li>
      <li>{l10n.getString("landing-pricing-premium-feature-4")}</li>
      <li>{l10n.getString("landing-pricing-premium-feature-5")}</li>
      {trackerBlockingFeatureListingPremium}
    </ul>
  );

  /** List of free features **/
  const trackerBlockingFeatureListingFree = isFlagActive(
    props.runtimeData,
    "tracker_removal"
  ) ? (
    <li>{l10n.getString("landing-pricing-free-feature-3")}</li>
  ) : null;
  const freeFeatures = (
    <ul className={styles.features}>
      <li>{l10n.getString("landing-pricing-free-feature-1-2")}</li>
      <li>{l10n.getString("landing-pricing-free-feature-2")}</li>
      {trackerBlockingFeatureListingFree}
    </ul>
  );

  /** If premium is not available, show waitlist panel **/
  const unavailablePremiumPanel = (
    <Link href="/premium/waitlist">
      <a className={`${styles.plan} ${styles["wide-plan"]}`}>
        <img
          src={RelayPremiumWordmark.src}
          alt="Firefox Relay Premium"
          className={styles["word-mark"]}
        />
        {premiumFeatures}
        <div className={styles["plan-description"]}>
          {l10n.getString("landing-pricing-waitlist-description")}
        </div>
        <div className={styles["faux-button"]}>
          {l10n.getString("waitlist-submit-label")}
        </div>
      </a>
    </Link>
  );

  /** If premium is not available, highlight the Free Relay experience **/
  const unavailablePremiumEncourageFreeRelay = (
    <a
      href={getRuntimeConfig().fxaLoginUrl}
      className={`${styles.plan} ${styles["wide-plan"]} ${styles["waitlist-cta"]}`}
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
        className={styles["word-mark"]}
      />
      <div className={styles["ribbon"]}>
        <span className={styles["ribbon-text"]}>
          {l10n.getString("landing-pricing-free-ribbon")}
        </span>
      </div>
      <b className={styles.price}>
        {l10n.getString("landing-pricing-free-price")}
      </b>
      {freeFeatures}
      <div className={styles["plan-description"]}>
        {l10n.getString("landing-pricing-free-description")}
      </div>
      <div ref={freeFauxButtonRef} className={styles["faux-button"]}>
        {l10n.getString("landing-pricing-free-cta")}
      </div>
    </a>
  );

  const freePlanCard = isPremiumAvailableInCountry(props.runtimeData) ? (
    <a
      href={getRuntimeConfig().fxaLoginUrl}
      className={`${styles.plan} ${styles["free-plan"]}`}
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
        className={styles["word-mark"]}
      />
      <b className={styles.price}>
        {l10n.getString("landing-pricing-free-price")}
      </b>
      {freeFeatures}
      <div ref={freeFauxButtonRef} className={styles["faux-button"]}>
        {l10n.getString("landing-pricing-free-cta")}
      </div>
    </a>
  ) : (
    unavailablePremiumPanel
  );
  const topPremiumDetail = isPremiumAvailableInCountry(props.runtimeData) ? (
    <span className={styles.callout}>
      {l10n.getString("landing-pricing-premium-price-highlight")}
    </span>
  ) : null;

  const premiumPlanCard = isPremiumAvailableInCountry(props.runtimeData) ? (
    <a
      href={getPremiumSubscribeLink(props.runtimeData)}
      onClick={() => trackPurchaseStart()}
      className={`${styles.plan} ${styles["premium-plan"]}`}
    >
      <img
        src={RelayPremiumWordmark.src}
        alt="Firefox Relay Premium"
        className={styles["word-mark"]}
      />
      <b className={styles.price}>
        {l10n.getString("landing-pricing-premium-price", {
          monthly_price: getPlan(props.runtimeData).price,
        })}
      </b>
      {premiumFeatures}
      <div ref={premiumFauxButtonRef} className={styles["faux-button"]}>
        {l10n.getString("nav-profile-sign-up")}
      </div>
    </a>
  ) : (
    unavailablePremiumEncourageFreeRelay
  );

  return (
    <div
      className={
        isPremiumAvailableInCountry(props.runtimeData)
          ? styles["comparison"]
          : styles["comparison-waitlist"]
      }
    >
      {/* Free Plan */}
      {freePlanCard}
      {/* Premium Plan */}
      {topPremiumDetail}
      {premiumPlanCard}
    </div>
  );
};
