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
    <div className={`${styles.banner} ${styles[type]}`}>
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
