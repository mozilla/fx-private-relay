import styles from "./WhatsNewContent.module.scss";

export type Props = {
  heading: string;
  description: string;
  image: string;
  videos?: Record<string, string>;
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
      <Hero image={props.image} videos={props.videos} />
      <div className={styles.content}>
        <h2>{props.heading}</h2>
        <p>{props.description}</p>
      </div>
    </div>
  );
};

const Hero = (props: Pick<Props, "image" | "videos">) => {
  if (typeof props.videos === "undefined") {
    return <img src={props.image} alt="" />;
  }

  const sources = Object.entries(props.videos).map(([type, source]) => (
    <source key={source} type={type} src={source} />
  ));

  return (
    <>
      <video
        // This animation is purely decorative, so screen readers should ignore it:
        aria-hidden={true}
        poster={props.image}
        autoPlay={true}
        loop={true}
        muted={true}
      >
        {sources}
        {/* Fall back to the image if the video formats are not supported: */}
        <img src={props.image} alt="" />
      </video>
      {/* This image will only be shown if the user has prefers-reduced-motion on */}
      <img className={styles["still-alternative"]} src={props.image} alt="" />
    </>
  );
};
