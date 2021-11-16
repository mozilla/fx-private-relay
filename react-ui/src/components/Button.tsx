import { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.scss";

export type Props = {
  children: ReactNode;
};

export const Button = (
  props: Props & ButtonHTMLAttributes<HTMLButtonElement>
) => {
  return (
    <button {...props} className={`${styles.button} ${props.className}`} />
  );
};
