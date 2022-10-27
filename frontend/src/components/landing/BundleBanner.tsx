import { FluentVariable } from "@fluent/bundle";
import { Localized, useLocalization } from "@fluent/react";
import {
  getBundlePrice,
  getBundleSubscribeLink,
  isBundleAvailableInCountry,
} from "../../functions/getPlan";
import { isFlagActive } from "../../functions/waffle";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { MaskIcon, MozillaVpnWordmark, PhoneIcon, VpnIcon } from "../Icons";
import styles from "./BundleBanner.module.scss";
import { LinkButton } from "../Button";
import womanInBanner400w from "./images/bundle-banner-woman-400w.png";
import womanInBanner768w from "./images/bundle-banner-woman-768w.png";
import bundleFloatOne from "./images/bundle-float-1.svg";
import bundleFloatTwo from "./images/bundle-float-2.svg";
import bundleFloatThree from "./images/bundle-float-3.svg";
import bundleLogo from "./images/vpn-and-relay-logo.svg";
import { trackPlanPurchaseStart } from "../../functions/trackPurchase";
import { useGaViewPing } from "../../hooks/gaViewPing";

export type Props = {
  runtimeData: RuntimeData;
};

type FloatingFeaturesProps = {
  icon: string;
  text: string;
  position: string;
  vars?: Record<string, FluentVariable>;
};

const FloatingFeatures = (props: FloatingFeaturesProps) => {
  const { l10n } = useLocalization();

  const text = props.vars ? (
    <Localized id={props.text} vars={props.vars}>
      <span className={styles["float-features-text"]} />
    </Localized>
  ) : (
    <span className={styles["float-features-text"]}>
      {l10n.getString(props.text)}
    </span>
  );

  return (
    <div
      className={`${styles[props.position]} ${styles["float-features-item"]}`}
    >
      <img alt="" src={props.icon} />
      {text}
    </div>
  );
};

export const BundleBanner = (props: Props) => {
  const { l10n } = useLocalization();

  const mainImage = (
    <img
      src={womanInBanner400w.src}
      srcSet={`${womanInBanner768w.src} 768w, ${womanInBanner400w.src} 400w`}
      sizes={`(max-width: 600px) 400px, 768px`}
      alt=""
      className={styles["main-image"]}
    />
  );

  const bundleUpgradeCta = useGaViewPing({
    category: "Bundle banner",
    label: "bundle-banner-upgrade-promo",
  });

  return (
    <div className={styles["bundle-banner-wrapper"]}>
      <div className={styles["first-section"]}>
        <div className={styles["main-img-wrapper"]}>{mainImage}</div>
        <div className={styles["float-features-wrapper"]}>
          <FloatingFeatures
            icon={bundleFloatOne.src}
            text="bundle-feature-one"
            position="feature-one"
            vars={{
              num_vpn_servers: "400",
            }}
          />
          <FloatingFeatures
            icon={bundleFloatTwo.src}
            text="bundle-feature-two"
            position="feature-two"
            vars={{
              num_vpn_countries: "30",
            }}
          />
          <FloatingFeatures
            icon={bundleFloatThree.src}
            text="bundle-feature-three"
            position="feature-three"
          />
        </div>
      </div>
      {isFlagActive(props.runtimeData, "bundle") &&
        isBundleAvailableInCountry(props.runtimeData) && (
          <div className={styles["second-section"]}>
            <div className={styles["bundle-banner-description"]}>
              <h2>
                <Localized
                  id={"bundle-banner-header"}
                  elems={{
                    "vpn-logo": <VpnWordmark />,
                  }}
                >
                  <span className={styles["headline"]} />
                </Localized>
              </h2>
              <h3>{l10n.getString("bundle-banner-subheader")}</h3>
              <p>
                {l10n.getString("bundle-banner-body-v2", { savings: "40%" })}
              </p>
              <p>
                <strong>{l10n.getString("bundle-banner-plan-header")}</strong>
              </p>
              <ul className={styles["bundle-banner-value-props"]}>
                <li>
                  <MaskIcon alt="" width="15" height="15" />
                  {l10n.getString("bundle-banner-plan-modules-email-masking")}
                </li>
                <li>
                  <PhoneIcon alt="" width="15" height="20" />
                  {l10n.getString("bundle-banner-plan-modules-phone-masking")}
                </li>
                <li>
                  <VpnIcon alt="" width="20" height="20" />
                  {l10n.getString("bundle-banner-plan-modules-mozilla-vpn")}
                </li>
              </ul>
              <div className={styles["pricing-logo-wrapper"]}>
                <div className={styles["pricing-wrapper"]}>
                  <Localized
                    id={"bundle-price-monthly"}
                    vars={{
                      monthly_price: getBundlePrice(props.runtimeData, l10n),
                    }}
                    elems={{
                      "monthly-price": <p className={styles["price"]} />,
                    }}
                  >
                    <span />
                  </Localized>
                  <Localized
                    id={"bundle-banner-savings-headline"}
                    vars={{
                      savings: "40%",
                    }}
                  >
                    <span />
                  </Localized>
                </div>
                <img
                  className={styles["bundle-logo"]}
                  src={bundleLogo.src}
                  alt={l10n.getString("bundle-banner-alt")}
                />
              </div>
              <div className={styles["bottom-section"]}>
                <LinkButton
                  ref={bundleUpgradeCta}
                  className={styles["button"]}
                  href={getBundleSubscribeLink(props.runtimeData)}
                  onClick={() =>
                    trackPlanPurchaseStart(
                      { plan: "bundle" },
                      { label: "bundle-banner-upgrade-promo" }
                    )
                  }
                >
                  {l10n.getString("bundle-banner-cta")}
                </LinkButton>
                <Localized
                  id={"bundle-banner-money-back-guarantee"}
                  vars={{
                    days_guarantee: "30",
                  }}
                >
                  <span className={styles["money-back-guarantee"]} />
                </Localized>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

const VpnWordmark = (props: { children?: string }) => {
  return (
    <>
      &nbsp;
      <MozillaVpnWordmark alt={props.children ?? "Mozilla VPN"} />
    </>
  );
};
