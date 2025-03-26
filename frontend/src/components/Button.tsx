import Link from "next/link";
import {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  forwardRef,
  ReactNode,
} from "react";
import styles from "./Button.module.scss";

export type Props = {
  children: ReactNode;
  variant?: "destructive" | "secondary";
  disabled?: boolean;
};

const variants = {
  destructive: styles["is-destructive"],
  secondary: styles["is-secondary"],
};
/**
 * Standard consistent styles for primary buttons.
 *
 * Note: it's wrapped in a `forwardRef` so that we can get access to the actual
 * button element in the DOM and send events when it is scrolled into view
 * using {@see useGaViewPing}.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  Props & ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
  return (
    <button
      {...props}
      ref={ref}
      className={`${styles.button} ${props.className} ${
        props.variant !== undefined ? variants[props.variant] : ""
      }`}
    />
  );
});
Button.displayName = "Button";

/**
 * Like {@link Button}, but for links (`<a>`).
 */
export const LinkButton = forwardRef<
  HTMLAnchorElement,
  Props & AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => {
  const { disabled, className, variant, href, children, ...rest } = props;

  const classes = `${styles.button} ${className ?? ""} ${
    variant === "destructive" ? styles["is-destructive"] : ""
  } ${disabled ? styles["disabled"] : ""}`;

  if (href?.startsWith("/") && !disabled) {
    return (
      <Link href={href} {...rest} ref={ref} className={classes}>
        {children}
      </Link>
    );
  }

  if (disabled) {
    return (
      <span className={classes} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <a href={href} {...rest} ref={ref} className={classes}>
      {children}
    </a>
  );
});
LinkButton.displayName = "LinkButton";
