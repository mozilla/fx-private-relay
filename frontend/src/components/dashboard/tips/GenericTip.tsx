import { ReactNode } from "react";
import styles from "./GenericTip.module.scss";

export type GenericTipProps = {
  title: string;
  content: ReactNode;
};
// This component will probably be used for future tips that are yet to be added:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const GenericTip = (props: GenericTipProps) => {
  return (
    <div className={styles["generic-tip"]}>
      <h3>{props.title}</h3>
      {props.content}
    </div>
  );
};
