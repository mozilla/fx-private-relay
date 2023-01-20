import Image, { StaticImageData } from "next/image";
import { ReactNode } from "react";
import styles from "./ContentHero.module.scss";

export type Props = {
  heading: string;
  body: ReactNode;
  heroImage: StaticImageData;
  /**
   * Whether text should be shown before (e.g. on the left side, in English) the
   * hero image. Only applies on wide screens; on small screens, the hero image
   * will always be below the text.
   */
  textFirst?: boolean;
};

export const CarouselContentHero = (props: Props) => {
  return (
    <div
      className={`${styles.wrapper} ${
        props.textFirst ? styles["text-first"] : styles["hero-first"]
      }`}
    >
      <div className={styles.text}>
        <div className={styles.heading}>{props.heading}</div>
        <div className={styles.body}>{props.body}</div>
      </div>
      <div className={styles.hero}>
        <Image src={props.heroImage} alt="" />
      </div>
    </div>
  );
};
