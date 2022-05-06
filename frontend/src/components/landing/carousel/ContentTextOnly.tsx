import { ReactNode } from "react";
import styles from "./ContentTextOnly.module.scss";

export type Props = {
  heading: string;
  body: ReactNode;
};

export const CarouselContentTextOnly = (props: Props) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>{props.heading}</div>
      <div className={styles.body}>{props.body}</div>
    </div>
  );
};
