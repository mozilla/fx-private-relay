import { useLocalization } from "@fluent/react";
import FxBrowserLogo from "../../../../static/scss/libs/protocol/img/logos/firefox/browser/logo.svg";
import styles from "./Reviews.module.scss";

/**
 * Reviews that help user decide if they want to use relay.
 */
export const Reviews = () => {
  const { l10n } = useLocalization();

  return (
    <section id="reviews" className={styles.wrapper}>
      <div className={styles.reviews}>
        <div className={styles["logo-container"]}>
          <img className={styles["logo"]} src={FxBrowserLogo.src} alt="" />
          <p className={styles["logo-title"]}>
            {l10n.getString("brand-name-firefox-browser")}
          </p>
          <p className={styles["logo-text"]}>
            {l10n.getString("reviews-add-ons")}
          </p>
        </div>
        <div className={styles["review-rating"]}></div>
        <div className={styles.review}></div>
      </div>
    </section>
  );
};
