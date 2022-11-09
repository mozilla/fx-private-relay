import { useLocalization } from "@fluent/react";
import { ReactNode } from "react";
import { getLocale } from "../../../functions/getLocale";
import styles from "./GenericTip.module.scss";

export type GenericTipProps = {
  title: string;
  content: ReactNode;
  videos?: Record<string, string>;
};
// This component will probably be used for future tips that are yet to be added:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const GenericTip = (props: GenericTipProps) => {
  const { l10n } = useLocalization();

  const sources = Object.entries(props.videos ?? {}).map(([type, source]) => (
    <source key={source} type={type} src={source} />
  ));
  const video =
    props.videos && getLocale(l10n).split("-")[0] === "en" ? (
      <video
        // The video usually uses animation to present the same information as
        // the text below in an easier-to-understand way. Thus, there is no text
        // alternative that wouldn't be redundant with the text below:
        aria-hidden={true}
        autoPlay={true}
        loop={true}
        muted={true}
        playsInline={true}
      >
        {sources}
      </video>
    ) : null;

  return (
    <div className={styles["generic-tip"]}>
      {video}
      <h3>{props.title}</h3>
      {props.content}
    </div>
  );
};
