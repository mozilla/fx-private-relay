import {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  forwardRef,
  ReactNode,
} from "react";
import styles from "./Button.module.scss";

export type Props = {
  children: ReactNode;
  variant?: "normal" | "destructive";
};

export const Button = forwardRef<
  HTMLButtonElement,
  Props & ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
  return (
    <button
      {...props}
      ref={ref}
      className={`${styles.button} ${props.className} ${
        props.variant === "destructive" ? styles.isDestructive : ""
      }`}
    />
  );
});
Button.displayName = "Button";

export const LinkButton = forwardRef<
  HTMLAnchorElement,
  Props & AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => {
  return (
    <a
      {...props}
      ref={ref}
      className={`${styles.button} ${props.className} ${
        props.variant === "destructive" ? styles.isDestructive : ""
      }`}
    />
  );
});
LinkButton.displayName = "LinkButton";
