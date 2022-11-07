import { ReactNode } from "react";
import { OutboundLink } from "react-ga";
import { useLocalization } from "@fluent/react";
import Link from "next/link";
import styles from "./Banner.module.scss";
import { useLocalDismissal } from "../hooks/localDismissal";
import { CloseIcon, WarningFilledIcon, InfoFilledIcon } from "./Icons";
import { useGaViewPing } from "../hooks/gaViewPing";

export type BannerProps = {
  children: ReactNode;
  type: "promo" | "warning" | "info";
  title?: string;
  illustration?: { img: ReactNode; type?: "flex-end" };
  cta?: BannerCtaProps;
  /**
   * See {@link useLocalDismissal}; determines whether and for how long the user can dismiss this banner.
   */
  dismissal?: {
    key: string;
    duration?: number;
  };
  hiddenWithAddon?: boolean;
};

/**
 * Standard layouts for banners we can show to the user.
 *
 * See {@link BannerProps["type"]} for the different types of banner themes supported.
 */
export const Banner = (props: BannerProps) => {
  const dismissal = useLocalDismissal(props.dismissal?.key ?? "unused", {
    duration: props.dismissal?.duration,
  });
  const { l10n } = useLocalization();
  const type = props.type ?? "warning";

  const warningIcon = (
    <WarningFilledIcon alt="" className={styles.icon} width={20} height={20} />
  );
  const infoIcon =
    type === "info" ? (
      <div className={styles["info-icon"]}>
        <InfoFilledIcon alt="" className={styles.icon} width={20} height={20} />
      </div>
    ) : null;

  const title =
    typeof props.title !== "undefined"
      ? (type === "warning" && (
          <h2 className={styles.title}>
            {warningIcon}
            {props.title}
          </h2>
        )) ||
        (["info", "promo"].includes(type) && (
          <h2 className={styles.title}>
            {infoIcon}
            {props.title}
          </h2>
        ))
      : null;

  const illustration = props.illustration ? (
    <div
      className={`
          ${styles.illustration} 
          ${props.illustration.type ? styles[props.illustration.type] : null}
        `}
    >
      {props.illustration.img}
    </div>
  ) : null;

  const cta = props.cta ? <BannerCta {...props.cta} /> : null;

  const dismissButton =
    typeof props.dismissal !== "undefined" ? (
      <button
        className={styles["dismiss-button"]}
        onClick={() => {
          dismissal.dismiss();
        }}
        title={l10n.getString("banner-dismiss")}
      >
        <CloseIcon alt={l10n.getString("banner-dismiss")} />
      </button>
    ) : null;

  // The add-on will hide anything with the class `is-hidden-with-addon`
  // if it's installed.
  // (Note that that should be the literal class name, i.e. it shouldn't
  // be imported from the CSS module.)
  if (!dismissal.isDismissed) {
    return (
      <div
        className={`${styles.banner} ${styles[type]} ${
          props.hiddenWithAddon === true ? "is-hidden-with-addon" : ""
        }`}
      >
        <div className={`${styles["highlight-wrapper"]}`}>
          {illustration}
          {typeof props.title === "undefined" ? infoIcon : null}
          <div className={styles["title-and-large-cta-wrapper"]}>
            <div className={`${styles["title-text"]}`}>
              {title}
              {props.children}
              {/* A regular-sized button is shown close to the content… */}
              {props.cta?.size !== "large" ? cta : null}
            </div>
            {/* …whereas a large button can stand on its own. */}
            {props.cta?.size === "large" ? cta : null}
          </div>
        </div>
        {dismissButton}
      </div>
    );
  }

  return null;
};

type BannerCtaProps = {
  /**
   * URL for the call-to-action to link to. Optional, but `onClick` is required when left out — the CTA will then be a button rather than a link.
   */
  target?: string;
  content: string;
  /**
   * Callback to run when the call-to-action is activated. Optional if `target` is provided.
   */
  onClick?: () => void;
  gaViewPing?: Parameters<typeof useGaViewPing>[0];
  size?: "medium" | "large";
} & ({ target: string } | { onClick: () => void }); // At least one of `target` and `onClick` is required:
export const BannerCta = (props: BannerCtaProps) => {
  const ctaRef = useGaViewPing(props.gaViewPing ?? null);

  // If no URL to link to is provided (via `target`), render a <button> rather than an <a>:
  if (typeof props.target !== "string") {
    return (
      <div
        className={
          props.size === "large" ? styles["cta-large-button"] : styles.cta
        }
      >
        <button onClick={props.onClick}>
          <span ref={ctaRef}>{props.content}</span>
        </button>
      </div>
    );
  }

  // When given a relative URL to link to in `target`, render an <a> (via <Link>):
  if (props.target.startsWith("/")) {
    return (
      <div
        className={
          props.size === "large" ? styles["cta-large-button"] : styles.cta
        }
      >
        <Link href={props.target}>
          <a onClick={props.onClick} ref={ctaRef}>
            {props.content}
          </a>
        </Link>
      </div>
    );
  }

  // When given a URL to link to in `target`, render an <a> (via <OutboundLink>):
  return (
    <div
      className={
        props.size === "large" ? styles["cta-large-button"] : styles.cta
      }
    >
      <OutboundLink
        to={props.target}
        eventLabel={props.content}
        target="_blank"
        rel="noopener noreferrer"
        onClick={props.onClick}
      >
        <span ref={ctaRef}>{props.content}</span>
      </OutboundLink>
    </div>
  );
};
