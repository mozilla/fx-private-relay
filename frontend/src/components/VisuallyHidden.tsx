import { ReactNode } from "react";
import styles from "./VisuallyHidden.module.scss";

export const VisuallyHidden = (props: { children: ReactNode }) => {
  return <div className={styles["visually-hidden"]}>{props.children}</div>;
};
