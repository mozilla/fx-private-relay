import { ReactNode } from "react";
import styles from "./Banner.module.scss";
import warningIcon from "../../../static/images/icon-orange-info.svg";

export type BannerProps = {
  children: ReactNode;
  type?: "warning";
  title?: string;
};

export const Banner = (props: BannerProps) => {
  const type = props.type ?? "warning";
  const icon = <img src={warningIcon.src} alt="" className={styles.icon} />;
  const title =
    typeof props.title !== "undefined" ? (
      <h2 className={styles.title}>
        {icon}
        {props.title}
      </h2>
    ) : null;

  return (
    <div className={styles.banner}>
      <div className={`${styles.highlightWrapper} ${styles[type]}`}>
        {title}
        {props.children}
      </div>
    </div>
  );
};
