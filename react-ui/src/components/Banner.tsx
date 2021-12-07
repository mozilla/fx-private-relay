import { ReactNode } from "react";
import styles from "./Banner.module.scss";
import warningIcon from "../../../static/images/icon-orange-info.svg";

export type BannerProps = {
  children: ReactNode;
  type?: "promo" | "warning";
  title?: string;
  illustration?: ReactNode;
  cta?: {
    target: string;
    content: string;
  };
  hiddenWithAddon?: boolean;
};

export const Banner = (props: BannerProps) => {
  const type = props.type ?? "warning";
  const icon =
    props.type === "warning" ? (
      <img src={warningIcon.src} alt="" className={styles.icon} />
    ) : null;
  const title =
    typeof props.title !== "undefined" ? (
      <h2 className={styles.title}>
        {icon}
        {props.title}
      </h2>
    ) : null;

  const illustration = props.illustration ? (
    <div className={styles.illustration}>{props.illustration}</div>
  ) : null;

  const cta = props.cta ? (
    <div className={styles.cta}>
      <a href={props.cta.target} target="_blank" rel="noopener noreferrer">
        {props.cta.content}
      </a>
    </div>
  ) : null;

  return (
    // The add-on will hide anything with the class `is-hidden-with-addon`
    // if it's installed.
    // (Note that that should be the literal class name, i.e. it shouldn't
    // be imported from the CSS module.)
    <div
      className={`${styles.banner} ${styles[type]} ${
        props.hiddenWithAddon === true ? "is-hidden-with-addon" : ""
      }`}
    >
      <div className={`${styles.highlightWrapper}`}>
        {illustration}
        <div>
          {title}
          {props.children}
          {cta}
        </div>
      </div>
    </div>
  );
};
