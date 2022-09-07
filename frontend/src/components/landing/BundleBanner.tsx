import { Button } from "../Button";
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
            text="More than 400 servers"
            position="feature-one"
          />
          <FloatingFeatures
            icon={bundleFloatTwo.src}
            text="More than 30 countries"
            position="feature-two"
          />
          <FloatingFeatures
            icon={bundleFloatThree.src}
            text="Fast and secure network"
            position="feature-three"
          />
        </div>
      </div>
      <div className={styles["second-section"]}>
        <div className={styles["bundle-banner-description"]}>
          <h2>Firefox Relay with VPN</h2>
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
