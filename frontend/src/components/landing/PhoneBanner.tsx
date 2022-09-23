import { useLocalization } from "@fluent/react";
import { StaticImageData } from "next/image";
import { useId } from "react-aria";
import { ReactElement } from "react";
import styles from "./PhoneBanner.module.scss";
import womanInBannerPng from "./images/phone-banner-woman.png";
import womanInBannerWebp from "./images/phone-banner-woman.webp";
import floatClock from "./images/phone-float-clock.svg";
import floatAccount from "./images/phone-float-account.svg";
import floatHeart from "./images/phone-float-heart.png";
import floatPhone from "./images/phone-float-phone.png";

export type Props = {
  cta: ReactElement;
};

export const PhoneBanner = (props: Props) => {
  const { l10n } = useLocalization();

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <b className={styles.callout}>
          <span className={styles.pill}>
            {l10n.getString("phone-banner-pill-new")}
          </span>{" "}
          <span>{l10n.getString("phone-banner-callout")}</span>
        </b>
        <h2>{l10n.getString("phone-banner-header")}</h2>
        <p>{l10n.getString("phone-banner-body")}</p>
        {props.cta}
      </div>
      <div className={styles.illustration}>
        <PersonInCircle pngImg={womanInBannerPng} webpImg={womanInBannerWebp} />
        <ul className={styles["floating-features"]}>
          <li className={styles["with-text"]}>
            <img src={floatClock.src} alt="" />
            {l10n.getString("phone-banner-float-limits", {
              nr_calls: 50,
              nr_texts: 75,
            })}
          </li>
          <li className={styles["with-text"]}>
            <img src={floatAccount.src} alt="" />
            {l10n.getString("phone-banner-float-replies")}
          </li>
          <li aria-hidden className={styles["image-only"]}>
            <img src={floatHeart.src} alt="" />
          </li>
          <li aria-hidden className={styles["image-only"]}>
            <img src={floatPhone.src} alt="" />
          </li>
        </ul>
      </div>
    </div>
  );
};

const PersonInCircle = (props: {
  pngImg: StaticImageData;
  webpImg: StaticImageData;
}) => {
  const maskId = useId();
  const gradientId = useId();
  const topMargin = 20;
  const diameter = props.pngImg.height + topMargin;

  return (
    <svg
      role="img"
      aria-hidden={true}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${diameter} ${diameter}`}
      width={diameter}
      height={diameter}
    >
      <defs>
        <mask id={maskId}>
          <circle
            fill="#ffffff"
            cx={diameter / 2}
            cy={diameter / 2}
            r={diameter / 2}
          />
        </mask>
        <linearGradient id={gradientId}>
          <stop stopColor="#b833e1" offset={0} />
          <stop stopColor="#4e1a69" offset={1} />
        </linearGradient>
      </defs>
      <circle
        fill={`url(#${gradientId})`}
        cx={diameter / 2}
        cy={diameter / 2}
        r={diameter / 2}
      />
      {/* SVG's <image> tag doesn't support fallbacks for different formats. */}
      {/* By using a <foreignObject>, we can use HTML's <picture> for that. */}
      <foreignObject
        width={props.pngImg.width}
        height={props.pngImg.height}
        preserveAspectRatio="none"
        href={props.pngImg.src}
        x={(diameter - props.pngImg.width) / 2}
        y={topMargin}
        mask={`url(#${maskId})`}
      >
        <picture>
          <source type="image/webp" srcSet={props.webpImg.src} />
          <img src={props.pngImg.src} alt="" />
        </picture>
      </foreignObject>
    </svg>
  );
};
