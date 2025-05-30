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
  const classes = `${styles.button} ${props.className ?? ""} ${
    props.variant === "destructive" ? styles["is-destructive"] : ""
  } ${props.disabled ? styles["disabled"] : ""}`;

  if (props.href?.startsWith("/") && !props.disabled) {
    const propsWithoutHref = { ...props };
    delete propsWithoutHref.href;

    return (
      <Link
        href={props.href}
        {...propsWithoutHref}
        ref={ref}
        className={classes}
      >
        {props.children}
      </Link>
    );
  }

  if (props.disabled) {
    return (
      <span className={classes} aria-disabled="true">
        {props.children}
      </span>
    );
  }

  return (
    <a href={props.href} {...props} ref={ref} className={classes}>
      {props.children}
    </a>
  );
});

LinkButton.displayName = "LinkButton";
