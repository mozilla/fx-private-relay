import { useLocalization } from "@fluent/react";
import FxBrowserLogo from "../../../../static/scss/libs/protocol/img/logos/firefox/browser/logo.svg";
import { StarIcon } from "../Icons";
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
        <div className={styles["rating-container"]}>
          <div className={styles.stars}>
            <StarIcon className={styles.star} alt="" />
            <StarIcon className={styles.star} alt="" />
            <StarIcon className={styles.star} alt="" />
            <StarIcon className={styles.star} alt="" />
            <StarIcon className={styles["empty-star"]} alt="" />
          </div>
          <div className={styles.rating}>
            <p className={styles.title}>4.2</p>
            <p className={styles.text}>out of 5 (328 reviews)</p>
          </div>
        </div>
        <div className={styles.review}></div>
      </div>
    </section>
  );
};
