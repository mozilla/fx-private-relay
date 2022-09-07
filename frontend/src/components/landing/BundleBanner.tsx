import { Localized, useLocalization } from "@fluent/react";
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

const FloatingFeatures = (props: FloatingFeaturesProps) => {
  return (
    <div
      className={`${styles[props.position]} ${styles["float-features-item"]}`}
    >
      <img alt={props.text} src={props.icon} />
      <span className={styles["float-features-text"]}>{props.text}</span>
    </div>
  );
};

export const BundleBanner = () => {
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
              <th scope="row" />
            </Localized>
          </h2>
          <h3>
            Security, reliability and speed — on every device, anywhere you go.
          </h3>
          <p>
            Surf, stream, game, and get work done while maintaining your privacy
            online. Whether you’re traveling, using public Wi-Fi, or simply
            looking for more online security, we will always put your privacy
            first.
          </p>
          <p>
            1 year plan: <strong>Firefox Relay Premium + Mozilla VPN</strong>
          </p>
          <div className={styles["pricing-logo-wrapper"]}>
            <div className={styles["pricing-wrapper"]}>
              <span>
                <strong>Monthly:</strong>
                <p className={styles["price"]}>$4.99</p>
              </span>
              <span>
                <strong>Save 50%</strong>
                <p className={styles["price"]}>Normally $11.99</p>
              </span>
            </div>
            <img src={bundleLogo.src} alt="Bundle logo" />
          </div>
          <Button className={styles["button"]}>Get VPN + Relay</Button>
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
