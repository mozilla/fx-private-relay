import { ReactNode } from "react";
import { OutboundLink } from "react-ga";
import { useLocalization } from "@fluent/react";
import styles from "./Banner.module.scss";
import warningIcon from "../../../static/images/icon-orange-info.svg";
import { useLocalDismissal } from "../hooks/localDismissal";
import { CloseIcon } from "./icons/close";

export type BannerProps = {
  children: ReactNode;
  type?: "promo" | "warning";
  title?: string;
  illustration?: ReactNode;
  cta?: {
    target: string;
    content: string;
  };
  dismissal?: {
    key: string;
    duration?: number;
  },
  hiddenWithAddon?: boolean;
};

export const Banner = (props: BannerProps) => {
  const dismissal = useLocalDismissal(props.dismissal?.key ?? "unused", { duration: props.dismissal?.duration });
  const {l10n} = useLocalization();
  const type = props.type ?? "warning";
  const icon =
    props.type === "warning" ? (
      <img src={warningIcon.src} alt="" className={styles.icon} />
    ) : null;
  const title =
    typeof props.title !== "undefined" ? (
      <h2 className={styles.title}>
        {icon}
        {props.title}
      </h2>
    ) : null;

  const illustration = props.illustration ? (
    <div className={styles.illustration}>{props.illustration}</div>
  ) : null;

  const cta = props.cta ? (
    <div className={styles.cta}>
      <OutboundLink
        to={props.cta.target}
        eventLabel={props.cta.content}
        target="_blank"
        rel="noopener noreferrer"
      >
        {props.cta.content}
      </OutboundLink>
    </div>
  ) : null;

  const dismissButton = typeof props.dismissal !== "undefined"
    ? <button className={styles.dismissButton} onClick={() => dismissal.dismiss()} title={l10n.getString("banner-dismiss")}>
      <CloseIcon alt={l10n.getString("banner-dismiss")}/>
    </button>
    : null;

  return (
    // The add-on will hide anything with the class `is-hidden-with-addon`
    // if it's installed.
    // (Note that that should be the literal class name, i.e. it shouldn't
    // be imported from the CSS module.)
    <div
      className={`${styles.banner} ${styles[type]} ${
        props.hiddenWithAddon === true ? "is-hidden-with-addon" : ""
      }`}
    >
      <div className={`${styles.highlightWrapper}`}>
        {illustration}
        <div>
          {title}
          {props.children}
          {cta}
        </div>
      </div>
      {dismissButton}
    </div>
  );
};
