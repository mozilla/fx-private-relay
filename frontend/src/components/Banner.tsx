import { ReactNode } from "react";
import { OutboundLink } from "react-ga";
import { useLocalization } from "@fluent/react";
import styles from "./Banner.module.scss";
import { useLocalDismissal } from "../hooks/localDismissal";
import { CloseIcon, WarningFilledIcon, InfoFilledIcon } from "./Icons";
import { useGaViewPing } from "../hooks/gaViewPing";

export type BannerProps = {
  children: ReactNode;
  type?: "promo" | "warning" | "info";
  title?: string;
  illustration?: ReactNode;
  cta?: {
    target: string;
    content: string;
    onClick?: () => void;
    gaViewPing?: Parameters<typeof useGaViewPing>[0];
    size?: "medium" | "large";
  };
  btn?: {
    content: string;
    onClick?: () => void;
    gaViewPing?: Parameters<typeof useGaViewPing>[0];
  };
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
  const ctaRef = useGaViewPing(props.cta?.gaViewPing ?? null);
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
        (type === "info" && <h2 className={styles.title}>{props.title}</h2>)
      : null;

  const illustration = props.illustration ? (
    <div className={styles.illustration}>{props.illustration}</div>
  ) : null;

  const cta = props.cta ? (
    <div
      className={
        props.cta.size === "large" ? styles["cta-large-button"] : styles.cta
      }
    >
      <OutboundLink
        to={props.cta.target}
        eventLabel={props.cta.content}
        target="_blank"
        rel="noopener noreferrer"
        onClick={props.cta.onClick}
      >
        <span ref={ctaRef}>{props.cta.content}</span>
      </OutboundLink>
    </div>
  ) : null;

  const btn = props.btn ? (
    <div className={styles.cta}>
      <button onClick={props.btn.onClick}>
        <span ref={ctaRef}>{props.btn.content}</span>
      </button>
    </div>
  ) : null;

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
          {infoIcon}
          <div className={`${styles["title-text"]}`}>
            {title}
            {props.children}
            {props.cta?.size !== "large" ? cta : null}
            {btn}
          </div>
          {props.cta?.size === "large" ? cta : null}
        </div>
        {dismissButton}
      </div>
    );
  }

  return null;
};
