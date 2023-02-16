import { FluentVariable } from "@fluent/bundle";
import Image, { StaticImageData } from "next/image";
import {
  getBundlePrice,
  getBundleSubscribeLink,
  isBundleAvailableInCountry,
} from "../../functions/getPlan";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { MaskIcon, PhoneIcon, VpnIcon } from "../Icons";
import styles from "./BundleBanner.module.scss";
import { LinkButton } from "../Button";
import womanInBanner400w from "./images/bundle-banner-woman-400w.png";
import womanInBanner768w from "./images/bundle-banner-woman-768w.png";
import bundleFloatOne from "./images/bundle-float-1.svg";
import bundleFloatTwo from "./images/bundle-float-2.svg";
import bundleFloatThree from "./images/bundle-float-3.svg";
import { trackPlanPurchaseStart } from "../../functions/trackPurchase";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { useL10n } from "../../hooks/l10n";
import { Localized } from "../Localized";

export type Props = {
  runtimeData: RuntimeData;
};

type FloatingFeaturesProps = {
  icon: StaticImageData;
  text: string;
  position: string;
  vars?: Record<string, FluentVariable>;
};

const FloatingFeatures = (props: FloatingFeaturesProps) => {
  const l10n = useL10n();

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
      <Image alt="" src={props.icon} />
      {text}
    </div>
  );
};

export const BundleBanner = (props: Props) => {
  const l10n = useL10n();

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
            icon={bundleFloatOne}
            text="bundle-feature-one"
            position="feature-one"
            vars={{
              num_vpn_servers: "400",
            }}
          />
          <FloatingFeatures
            icon={bundleFloatTwo}
            text="bundle-feature-two"
            position="feature-two"
            vars={{
              num_vpn_countries: "30",
            }}
          />
          <FloatingFeatures
            icon={bundleFloatThree}
            text="bundle-feature-three"
            position="feature-three"
          />
        </div>
      </div>
      {isBundleAvailableInCountry(props.runtimeData) && (
        <div className={styles["second-section"]}>
          <div className={styles["bundle-banner-description"]}>
            {props.runtimeData && (
              <h2>
                {l10n.getString("bundle-banner-header-2", {
                  monthly_price: getBundlePrice(props.runtimeData, l10n),
                })}
              </h2>
            )}
            <p>{l10n.getString("bundle-banner-body-3", { savings: "40%" })}</p>
            <p className={styles["bundle-banner-one-year-plan-headline"]}>
              <strong>{l10n.getString("bundle-banner-plan-header-2")}</strong>
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
