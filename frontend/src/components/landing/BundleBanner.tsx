import { Button } from "../Button";
import styles from "./BundleBanner.module.scss";
import womanInBanner from "./images/bundle-banner-woman.png";

export const BundleBanner = () => {
  const mainImage = (
    <img
      src={womanInBanner.src}
      alt="Woman in Banner"
      className={styles["main-image"]}
    />
  );

  const bannerDescription = (
    <div className={styles["bundle-banner-description"]}>
      <h2>Firefox Relay with VPN</h2>
      <h3>
        Security, reliability and speed — on every device, anywhere you go.
      </h3>
      <p>
        Surf, stream, game, and get work done while maintaining your privacy
        online. Whether you’re traveling, using public Wi-Fi, or simply looking
        for more online security, we will always put your privacy first.
      </p>
      <p>
        1 year plan: <strong>Firefox Relay Premium + Mozilla VPN</strong>
      </p>
      <div className={styles["pricing-wrapper"]}>
        <span>
          <strong>Monthly: </strong>$4.99
        </span>
        <span>
          <strong>Save 50% </strong>Normally $11.99
        </span>
      </div>
      <Button>Sign up</Button>
    </div>
  );

  return (
    <div className={styles["bundle-banner-wrapper"]}>
      <div className={styles["img-wrapper"]}>{mainImage}</div>
      {bannerDescription}
    </div>
  );
};
