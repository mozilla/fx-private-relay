import styles from "./DemoPhone.module.scss";
import BgImage from "../../../../static/images/newlanding/a/hero-image-bg.svg";
import PremiumScreenshot from "../../../../static/images/newlanding/a/hero-image-premium.svg";
import NoPremiumScreenshot from "../../../../static/images/newlanding/a/hero-image-nopremium.svg";
import FgImage from "../../../../static/images/newlanding/a/hero-image-fg.svg";

export type Props = {
  premium?: boolean;
};

export const DemoPhone = (props: Props) => {
  return (
    <div className={styles.container}>
      <img src={BgImage.src} alt="" className={styles.background} />
      <img
        src={props.premium ? PremiumScreenshot.src : NoPremiumScreenshot.src}
        alt=""
      />
      <img src={FgImage.src} alt="" className={styles.foreground} />
    </div>
  );
};
