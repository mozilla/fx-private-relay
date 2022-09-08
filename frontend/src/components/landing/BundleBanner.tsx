import { Localized, useLocalization } from "@fluent/react";
import {
  getBundlePrice,
  isBundleAvailableInCountry,
} from "../../functions/getPlan";
import { isFlagActive } from "../../functions/waffle";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { Button } from "../Button";
import { MozillaVpnWordmark } from "../Icons";
import styles from "./BundleBanner.module.scss";
import womanInBanner from "./images/bundle-banner-woman.png";
import bundleFloatOne from "./images/bundle-float-1.svg";
import bundleFloatTwo from "./images/bundle-float-2.svg";
import bundleFloatThree from "./images/bundle-float-3.svg";
import bundleLogo from "./images/vpn-and-relay-logo.svg";

type FloatingFeaturesProps = {
  icon: string;
  text: string;
  position: string;
};

export type Props = {
  runtimeData: RuntimeData;
};

const FloatingFeatures = (props: FloatingFeaturesProps) => {
  return (
    <div
      className={`${styles[props.position]} ${styles["float-features-item"]}`}
    >
      <img alt="" src={props.icon} />
      <span className={styles["float-features-text"]}>{props.text}</span>
    </div>
  );
};

export const BundleBanner = (props: Props) => {
  const { l10n } = useLocalization();

  const mainImage = (
    <img
      src={womanInBanner.src}
      alt="Woman in Banner"
      className={styles["main-image"]}
    />
  );

  return (
    <div className={styles["bundle-banner-wrapper"]}>
      <div className={styles["first-section"]}>
        <div className={styles["main-img-wrapper"]}>{mainImage}</div>
        <div className={styles["float-features-wrapper"]}>
          <FloatingFeatures
            icon={bundleFloatOne.src}
            text={l10n.getString("bundle-feature-one")}
            position="feature-one"
          />
          <FloatingFeatures
            icon={bundleFloatTwo.src}
            text={l10n.getString("bundle-feature-two")}
            position="feature-two"
          />
          <FloatingFeatures
            icon={bundleFloatThree.src}
            text={l10n.getString("bundle-feature-three")}
            position="feature-three"
          />
        </div>
      </div>
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
          <p>{l10n.getString("bundle-banner-body")}</p>
          <Localized
            id={"bundle-banner-1-year-plan"}
            elems={{
              b: <b />,
            }}
          >
            <p />
          </Localized>
          {isFlagActive(props.runtimeData, "bundle") &&
            isBundleAvailableInCountry(props.runtimeData) && (
              <div className={styles["pricing-logo-wrapper"]}>
                <div className={styles["pricing-wrapper"]}>
                  <Localized
                    id={"bundle-price-monthly"}
                    vars={{
                      monthly_price: getBundlePrice(props.runtimeData),
                    }}
                    elems={{
                      "monthly-price": <p className={styles["price"]} />,
                    }}
                  >
                    <span />
                  </Localized>
                  <Localized
                    id={"bundle-price-save-amount"}
                    vars={{
                      savings: "??%", // Design states 50%
                      old_price: "$??", // Design states $11.99
                    }}
                    elems={{
                      "outdated-price": <p className={styles["price"]} />,
                    }}
                  >
                    <span />
                  </Localized>
                </div>
                <img src={bundleLogo.src} alt="Bundle logo" />
              </div>
            )}
          <Button className={styles["button"]}>
            {l10n.getString("bundle-banner-cta")}
          </Button>
        </div>
      </div>
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
