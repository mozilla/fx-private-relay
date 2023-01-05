import { TouchEventHandler, useRef, useState } from "react";
import { useButton } from "react-aria";
import FxBrowserLogo from "./images/fx-logo.svg";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  QuotationIcon,
  StarIcon,
} from "../Icons";
import styles from "./Reviews.module.scss";
import { getLocale } from "../../functions/getLocale";
import { useL10n } from "../../hooks/l10n";

// We want to ensure only these values can be used for a rating.
export type Rating = 1 | 2 | 3 | 4 | 5;
// We expect a normal string or a list of strings to use as a bulleted list.
export type Review = string | string[];
// Allowed directions for scrolling reviews
export type Direction = "left" | "right";
export type UserReview = {
  name: string;
  rating: Rating;
  text: Review;
};

// Reviews that help user decide if they want to use relay.
export const Reviews = () => {
  const [currentReview, setCurrentReview] = useState(0);
  const [scrollAnimationDirection, setScrollAnimationDirection] =
    useState<Direction>("left");
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const l10n = useL10n();

  const slideLeftButtonRef = useRef<HTMLButtonElement>(null);

  const slideLeftButton = useButton(
    { onPress: () => scrollReview(currentReview, userReviews, "right") },
    slideLeftButtonRef
  );

  const slideRightButtonRef = useRef<HTMLButtonElement>(null);

  const slideRightButton = useButton(
    { onPress: () => scrollReview(currentReview, userReviews, "left") },
    slideRightButtonRef
  );

  // Get initial user position on touch
  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  // Get end position when user ends touch
  const handleTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Figure out if user swiped left or right
  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = () => {
    // user swiped left
    if (touchStart - touchEnd > 150) {
      scrollReview(currentReview, userReviews, "left");
    }

    // user swiped right
    if (touchStart - touchEnd < -150) {
      scrollReview(currentReview, userReviews, "right");
    }
  };

  const userReviews: UserReview[] = [
    {
      name: "Jon",
      rating: 5,
      text: l10n.getString("landing-review-user-one-review"),
    },
    {
      name: `${l10n.getString("landing-review-anonymous-user", {
        user_id: "17064608",
      })}`,
      rating: 5,
      text: l10n.getString("landing-review-user-two-review"),
    },
    {
      name: `${l10n.getString("landing-review-anonymous-user", {
        user_id: "16464118",
      })}`,
      rating: 5,
      text: l10n.getString("landing-review-user-three-review"),
    },
    {
      name: `${l10n.getString("landing-review-anonymous-user", {
        user_id: "17361666",
      })}`,
      rating: 5,
      text: [
        l10n.getString("landing-review-user-four-review-list-1"),
        l10n.getString("landing-review-user-four-review-list-2"),
        l10n.getString("landing-review-user-four-review-list-3"),
        l10n.getString("landing-review-user-four-review-list-4"),
      ],
    },
  ];

  const reviewCount = 1055;
  const { name, text, rating } = userReviews[currentReview];

  const scrollReview = (
    count: number,
    reviews: UserReview[],
    direction: Direction
  ): void => {
    if (direction === "right") {
      setCurrentReview(count < reviews.length - 1 ? count + 1 : 0);
    } else if (direction === "left") {
      setCurrentReview(count > 0 ? count - 1 : reviews.length - 1);
    }

    setScrollAnimationDirection(direction);
  };

  // We create an array with a length of 5
  // which represents the max number of stars a rating can achieve.
  // We iterate that array and map to stars based on rating passed
  // into function.
  const renderStarRating = (rating: Rating) =>
    [...Array(5)].map((star, index) =>
      index < rating ? (
        <StarIcon className={styles.star} key={index} alt="" />
      ) : (
        <StarIcon className={styles["empty-star"]} key={index} alt="" />
      )
    );

  // Render a bulleted list if review is an array of strings.
  const renderReview = (text: Review) => {
    if (!Array.isArray(text)) return <p>{text}</p>;

    return (
      <ul>
        {text.map((item, index) => (
          <li key={index}>{item}</li>
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
              {l10n.getString("landing-reviews-logo-title")}
            </p>
            <p className={styles["logo-text"]}>
              {l10n.getString("landing-reviews-add-ons")}
            </p>
          </div>
          <div className={styles["rating-container"]}>
            <div className={styles.stars}>{renderStarRating(4)}</div>
            <div className={styles.rating}>
              <p className={styles.title}>
                {new Intl.NumberFormat(getLocale(l10n)).format(4.2)}
              </p>
              <p className={styles.text}>
                {l10n.getString("landing-reviews-rating", {
                  review_count: reviewCount,
                })}
              </p>
            </div>
          </div>
        </div>

        <div className={styles["right-container"]}>
          <div className={styles["reviews-container"]}>
            <button
              {...slideLeftButton.buttonProps}
              ref={slideLeftButtonRef}
              aria-label={l10n.getString("landing-reviews-show-next-button")}
              className={`${styles.chevron} ${styles["hidden-mobile"]}`}
            >
              <ChevronLeftIcon alt="" />
            </button>

            <div
              className={styles["review-container"]}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                key={currentReview}
                className={`${styles.review} ${
                  styles[`scroll-${scrollAnimationDirection}`]
                }`}
              >
                <div className={styles["quotation-icon"]}>
                  <QuotationIcon alt="" />
                  <QuotationIcon alt="" />
                </div>
                <div className={styles.details}>
                  <div className={styles.stars}>{renderStarRating(rating)}</div>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.source}>
                    {l10n.getString("landing-reviews-details-source")}
                  </span>
                </div>
                <div className={styles.text}>
                  {/* if text is an array, we consider it a bulleted list */}
                  {renderReview(text)}
                </div>
              </div>
            </div>

            <button
              {...slideRightButton.buttonProps}
              ref={slideRightButtonRef}
              aria-label={l10n.getString(
                "landing-reviews-show-previous-button"
              )}
              className={`${styles.chevron} ${styles["hidden-mobile"]}`}
            >
              <ChevronRightIcon alt="" />
            </button>
          </div>

          {/* these controls will only show on mobile  */}
          <div
            className={`${styles["mobile-controls"]} ${styles["show-mobile"]}`}
          >
            <button
              {...slideLeftButton.buttonProps}
              ref={slideLeftButtonRef}
              aria-label={l10n.getString("landing-reviews-show-next-button")}
              className={`${styles.chevron}`}
            >
              <ChevronLeftIcon alt="" />
            </button>
            <button
              {...slideRightButton.buttonProps}
              ref={slideRightButtonRef}
              aria-label={l10n.getString(
                "landing-reviews-show-previous-button"
              )}
              className={`${styles.chevron}`}
            >
              <ChevronRightIcon alt="" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
