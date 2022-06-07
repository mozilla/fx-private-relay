import { useLocalization } from "@fluent/react";
import { createRef, TouchEventHandler, useEffect, useState } from "react";
import FxBrowserLogo from "../../../../static/scss/libs/protocol/img/logos/firefox/browser/logo.svg";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  QuotationIcon,
  StarIcon,
} from "../Icons";
import styles from "./Reviews.module.scss";

// We want to ensure only these values can be used for a rating.
export type Rating = 1 | 2 | 3 | 4 | 5;
export type Review = string | string[];
export type Direction = "left" | "right";
export type UserReview = {
  name: string;
  rating: Rating;
  text: Review;
};

// Reviews that help user decide if they want to use relay.
export const Reviews = () => {
  const [currentReview, setCurrentReview] = useState(0);
  const [scrollAnimationDirection, setScrollAnimationDirection] = useState("");
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const { l10n } = useLocalization();
  const reviewElementRef = createRef<HTMLDivElement>();

  function handleTouchStart(e: any) {
    setTouchStart(e.targetTouches[0].clientX);
  }

  function handleTouchMove(e: any) {
    setTouchEnd(e.targetTouches[0].clientX);
  }

  function handleTouchEnd() {
    // user swiped left
    if (touchStart - touchEnd > 150) {
      scrollReview(currentReview, userReviews, "left");
    }

    // user swiped right
    if (touchStart - touchEnd < -150) {
      scrollReview(currentReview, userReviews, "right");
    }
  }

  const userReviews: UserReview[] = [
    {
      name: "Jon",
      rating: 5,
      text: l10n.getString("landing-review-user-one-review"),
    },
    {
      name: "Firefox user 17064608",
      rating: 5,
      text: l10n.getString("landing-review-user-two-review"),
    },
    {
      name: "Firefox user 16464118",
      rating: 5,
      text: l10n.getString("landing-review-user-three-review"),
    },
    {
      name: "Firefox user 17361666",
      rating: 5,
      text: [
        l10n.getString("landing-review-user-four-review-list-1"),
        l10n.getString("landing-review-user-four-review-list-2"),
        l10n.getString("landing-review-user-four-review-list-3"),
        l10n.getString("landing-review-user-four-review-list-4"),
      ],
    },
  ];

  const { name, text, rating } = userReviews[currentReview];

  useEffect(() => {}, [currentReview]);
  const scrollReview = (
    count: number,
    reviews: UserReview[],
    direction: Direction
  ): void => {
    const animationClass = "scroll-" + direction;

    if (direction === "right") {
      setCurrentReview(count < reviews.length - 1 ? count + 1 : 0);
    } else if (direction === "left") {
      setCurrentReview(count > 0 ? count - 1 : reviews.length - 1);
    }

    setScrollAnimationDirection(animationClass);
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

  const renderReview = (text: Review) => {
    if (!Array.isArray(text)) return text;

    return (
      <ul>
        {text.map((item) => (
          <li>{item}</li>
        ))}
      </ul>
    );
  };

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
            <button
              className={`${styles.chevron} ${styles["hidden-mobile"]}`}
              onClick={() => scrollReview(currentReview, userReviews, "left")}
            >
              <ChevronLeftIcon alt="" />
            </button>
            <div className={styles["quotation-icon"]}>
              <QuotationIcon alt="" />
              <QuotationIcon alt="" />
            </div>

            <div
              className={styles["review-container"]}
              onTouchStart={(e) => handleTouchStart(e)}
              onTouchMove={(e) => handleTouchMove(e)}
              onTouchEnd={() => handleTouchEnd()}
            >
              <div
                ref={reviewElementRef}
                key={currentReview}
                className={`${styles.review} ${styles[scrollAnimationDirection]}`}
              >
                <div className={styles.details}>
                  <div className={styles.stars}>{renderStarRating(rating)}</div>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.source}>
                    Source: addons.mozilla.org
                  </span>
                </div>
                <p className={styles.text}>
                  {/* if text is an array, we consider it a bulleted list */}
                  {renderReview(text)}
                </p>
              </div>
            </div>

            <button
              className={`${styles.chevron} ${styles["hidden-mobile"]}`}
              onClick={() => scrollReview(currentReview, userReviews, "right")}
            >
              <ChevronRightIcon alt="" />
            </button>
          </div>

          <div className={styles["mobile-controls"]}>
            <button
              className={`${styles.chevron} ${styles["show-mobile"]}`}
              onClick={() => scrollReview(currentReview, userReviews, "left")}
            >
              <ChevronLeftIcon alt="" />
            </button>
            <button
              className={`${styles.chevron} ${styles["show-mobile"]}`}
              onClick={() => scrollReview(currentReview, userReviews, "right")}
            >
              <ChevronRightIcon alt="" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
