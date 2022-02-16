import styles from "./WhatsNewContent.module.scss";

export type Props = {
  heading: string;
  description: string;
  image: string;
};

/**
 * Content of a "What's New" entry
 *
 * At the time of writing, they all look the same, and hence this is the only
 * component that is used for content. It's not too unlikely that more layouts
 * other than (image, title, then content) will be added in the future, though,
 * so when that happens, and we know more about what distinguishes those from
 * this component, we can rename this.
 */
export const WhatsNewContent = (props: Props) => {
  return (
    <div className={styles.wrapper}>
      <img src={props.image} alt="" />
      <div className={styles.content}>
        <h2>{props.heading}</h2>
        <p>{props.description}</p>
      </div>
    </div>
  );
};
