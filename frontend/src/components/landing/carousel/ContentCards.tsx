import Image, { StaticImageData } from "next/image";
import styles from "./ContentCards.module.scss";

export type Props = {
  heading: string;
  lead: string;
  cards: Array<{
    image: StaticImageData;
    heading: string;
    body: string;
  }>;
};

export const CarouselContentCards = (props: Props) => {
  return (
    <div className={`${styles.wrapper}`}>
      <div className={styles.text}>
        <div className={styles.heading}>{props.heading}</div>
        <div className={styles.lead}>{props.lead}</div>
      </div>
      <div className={styles.hero}>
        {props.cards.map((card, index) => {
          return (
            <div className={styles.card} key={index}>
              <div className={styles["card-image-container"]}>
                <Image src={card.image} alt="" />
              </div>
              <p className={styles["card-heading"]}>{card.heading}</p>
              <p className={styles["card-body"]}>{card.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
