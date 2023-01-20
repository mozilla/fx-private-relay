import Image, { StaticImageData } from "next/image";
import { ReactNode } from "react";
import { getLocale } from "../../../functions/getLocale";
import { useL10n } from "../../../hooks/l10n";
import styles from "./GenericTip.module.scss";

export type GenericTipProps = {
  title: string;
  content: ReactNode;
  videos?: Record<string, string>;
  image?: StaticImageData;
  alt?: string;
};
// This component will probably be used for future tips that are yet to be added:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const GenericTip = (props: GenericTipProps) => {
  const l10n = useL10n();

  const sources = Object.entries(props.videos ?? {}).map(([type, source]) => (
    <source key={source} type={type} src={source} />
  ));
  const video =
    props.videos && getLocale(l10n).split("-")[0] === "en" ? (
      <>
        <video
          // The video usually uses animation to present the same information as
          // the text below in an easier-to-understand way. Thus, there is no text
          // alternative that wouldn't be redundant with the text below:
          aria-hidden={true}
          poster={
            typeof props.image === "object" ? props.image.src : props.image
          }
          autoPlay={true}
          loop={true}
          muted={true}
          playsInline={true}
          title={props.alt}
        >
          {sources}
          {/* Fall back to the image if the video formats are not supported: */}
          {typeof props.image === "string" ? (
            <Image src={props.image} alt={props.alt ?? ""} />
          ) : null}
        </video>
        {/* This image will only be shown if the user has prefers-reduced-motion on */}
        {props.image && (
          <Image
            className={styles["still-alternative"]}
            src={props.image}
            alt={props.alt ?? ""}
          />
        )}
      </>
    ) : null;

  return (
    <div className={styles["generic-tip"]}>
      <h3>{props.title}</h3>
      {props.content}
      {/*
        Video listed last because that makes more sense for screen readers;
        it's usually an example of the text above.
        */}
      {video}
    </div>
  );
};
