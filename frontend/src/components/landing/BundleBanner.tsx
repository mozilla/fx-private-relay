import { FluentVariable } from "@fluent/bundle";
import { Localized, useLocalization } from "@fluent/react";
import {
  getBundlePrice,
  getBundleSubscribeLink,
  isBundleAvailableInCountry,
} from "../../functions/getPlan";
import { isFlagActive } from "../../functions/waffle";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { MozillaVpnWordmark } from "../Icons";
import styles from "./BundleBanner.module.scss";
import { LinkButton } from "../Button";
import womanInBanner from "./images/bundle-banner-woman.png";
import bundleFloatOne from "./images/bundle-float-1.svg";
import bundleFloatTwo from "./images/bundle-float-2.svg";
import bundleFloatThree from "./images/bundle-float-3.svg";
import bundleLogo from "./images/vpn-and-relay-logo.svg";

type FloatingFeaturesProps = {
  icon: string;
  text: string;
  position: string;
  vars?: Record<string, FluentVariable>;
};

export type Props = {
  runtimeData: RuntimeData;
};

const FloatingFeatures = (props: FloatingFeaturesProps) => {
  const { l10n } = useLocalization();

  const hasVariable = props.vars ? (
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
      {hasVariable}
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
              <p>{l10n.getString("bundle-banner-body")}</p>
              <Localized
                id={"bundle-banner-1-year-plan"}
                elems={{
                  b: <b />,
                }}
              >
                <p />
              </Localized>
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
                      "outdated-price": <s className={styles["price"]} />,
                    }}
                  >
                    <span />
                  </Localized>
                </div>
                <img src={bundleLogo.src} alt="Bundle logo" />
              </div>
              <div className={styles["bottom-section"]}>
                <LinkButton
                  target="_blank"
                  className={styles["button"]}
                  href={getBundleSubscribeLink(props.runtimeData)}
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
