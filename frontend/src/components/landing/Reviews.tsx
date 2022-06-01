import { useLocalization } from "@fluent/react";
import FxBrowserLogo from "../../../../static/scss/libs/protocol/img/logos/firefox/browser/logo.svg";
import { QuotationIcon, StarIcon } from "../Icons";
import styles from "./Reviews.module.scss";

/**
 * Reviews that help user decide if they want to use relay.
 */
export const Reviews = () => {
  const { l10n } = useLocalization();

  // We create an array with a length of 5
  // which represents the max number of stars a rating can achieve.
  // We iterate that array and map to stars based on rating passed
  // into function.
  const renderStarRating = (rating: 1 | 2 | 3 | 4 | 5) =>
    [...Array(5)].map((star, index) =>
      index < rating ? (
        <StarIcon className={styles.star} alt="" />
      ) : (
        <StarIcon className={styles["empty-star"]} alt="" />
      )
    );

  return (
    <section id="reviews" className={styles.wrapper}>
      <div className={styles.reviews}>
        <div className={styles["left-container"]}>
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
            <div className={styles.stars}>{renderStarRating(4)}</div>
            <div className={styles.rating}>
              <p className={styles.title}>4.2</p>
              <p className={styles.text}>out of 5 (328 reviews)</p>
            </div>
          </div>
        </div>

        <div className={styles["right-container"]}>
          <div className={styles["review-container"]}>
            <div className="review">
              <span className={styles["quotation-icon"]}>
                <QuotationIcon alt="" />
                <QuotationIcon alt="" />
              </span>
              <div className={styles.details}>
                {renderStarRating(4)}
                <span className={styles.name}>Firefox user</span>
                <span className={styles.date}>6 months ago</span>
                <span className={styles.source}>
                  Source: addons.mozzila.org
                </span>
              </div>
              <div className={styles.text}>
                It's quite a convenient addition to the mozilla ecosystem. Saves
                me from signing up for a dodgy or pricey alternative.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
