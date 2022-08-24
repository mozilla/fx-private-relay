import { OutboundLink } from "react-ga";
import {
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
  RuntimeDataWithPremiumAvailable,
} from "../../../../functions/getPlan";
import { useProfiles } from "../../../../hooks/api/profile";
import { useRuntimeData } from "../../../../hooks/api/runtimeData";
import { useGaViewPing } from "../../../../hooks/gaViewPing";
import styles from "./WhatsNewContent.module.scss";

export type Props = {
  heading: string;
  description: string;
  image: string;
  videos?: Record<string, string>;
  cta?: {
    type?: "upgrade" | undefined;
    target?: string;
    content: string;
    onClick?: () => void;
    gaViewPing?: Parameters<typeof useGaViewPing>[0];
  };
  runtimeDataWithPremiumAvailable?: RuntimeDataWithPremiumAvailable;
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
  const profiles = useProfiles();
  const runtimeData = useRuntimeData();
  const hasPremium: boolean = profiles.data?.[0].has_premium ?? false;

  // Non-upgrade CTAs
  const cta =
    props.cta && props.cta.target ? (
      <OutboundLink to={props.cta.target} eventLabel={props.cta.content}>
        <span>{props.cta.content}</span>
      </OutboundLink>
    ) : null;

  // Upgrade CTA
  const ctaUpgrade =
    !hasPremium &&
    isPremiumAvailableInCountry(runtimeData.data) &&
    props.cta &&
    props.cta.type === "upgrade" ? (
      <OutboundLink
        to={getPremiumSubscribeLink(runtimeData.data)}
        eventLabel={props.cta.content}
      >
        <span>{props.cta.content}</span>
      </OutboundLink>
    ) : null;

  return (
    <div className={styles.wrapper}>
      <Hero image={props.image} videos={props.videos} />
      <div className={styles.content}>
        <h2>{props.heading}</h2>
        <p>{props.description}</p>
        {cta}
        {ctaUpgrade}
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
