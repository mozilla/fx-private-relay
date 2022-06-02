import { useLocalization } from "@fluent/react";
import { MouseEventHandler, useState } from "react";
import FxBrowserLogo from "../../../../static/scss/libs/protocol/img/logos/firefox/browser/logo.svg";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  QuotationIcon,
  StarIcon,
} from "../Icons";
import styles from "./Reviews.module.scss";

export type Rating = 1 | 2 | 3 | 4 | 5;

export type UserReview = {
  name: string;
  rating: Rating;
  text: string;
};

const userReviews: UserReview[] = [
  {
    name: "Firefox user 17361666",
    rating: 5,
    text: "I really appreciate the Mozilla team for being so creative and simplifying the anonymizing of my e-mail address. This is a great extension, I highly recommend it to the privacy-aware!",
  },
  {
    name: "Firefox user 17064608",
    rating: 5,
    text: "Simple tool to get rid of or avoid spamming your email ID.",
  },
  {
    name: "Firefox user 16464118",
    rating: 5,
    text: "Love this extension! Very simple but powerful and the integration with the browser is wonderful.",
  },
];
/**
 * Reviews that help user decide if they want to use relay.
 */
export const Reviews = () => {
  const [currentReview, setCurrentReview] = useState(0);
  const { l10n } = useLocalization();

  const previousReview = (): MouseEventHandler<HTMLButtonElement> => {
    if (currentReview > 0) {
      setCurrentReview(currentReview - 1);
    }
  };

  const nextReview = (): MouseEventHandler<HTMLButtonElement> => {
    if (currentReview < userReviews.length - 1) {
      setCurrentReview(currentReview + 1);
    }
  };

  // We create an array with a length of 5
  // which represents the max number of stars a rating can achieve.
  // We iterate that array and map to stars based on rating passed
  // into function.
  const renderStarRating = (rating: Rating) =>
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
          <div className={styles["reviews-container"]}>
            <button className={styles.chevron} onClick={previousReview}>
              <ChevronLeftIcon alt="" />
            </button>
            <div className={styles["quotation-icon"]}>
              <QuotationIcon alt="" />
              <QuotationIcon alt="" />
            </div>

            <div className={styles["review-container"]}>
              <div className={styles.review}>
                <div className={styles.details}>
                  <div className={styles.stars}>
                    {renderStarRating(userReviews[currentReview].rating)}
                  </div>
                  <span className={styles.name}>
                    {userReviews[currentReview].name}
                  </span>
                  <span className={styles.date}>6 months ago</span>
                  <span className={styles.source}>
                    Source: addons.mozzila.org
                  </span>
                </div>
                <div className={styles.text}>
                  {userReviews[currentReview].text}
                </div>
              </div>
            </div>
            <button className={styles.chevron} onClick={nextReview}>
              <ChevronRightIcon alt="" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
