import Image, { StaticImageData } from "next/image";
import styles from "./DemoPhone.module.scss";
import BgImage from "./images/hero-image-bg.svg";
import PremiumScreenshot from "./images/hero-image-premium.svg";
import PremiumScreenshotFr from "./images/hero-image-premium-fr.svg";
import PremiumScreenshotDe from "./images/hero-image-premium-de.svg";
import NoPremiumScreenshot from "./images/hero-image-nopremium.svg";
import FgImage from "./images/hero-image-fg.svg";
import FgImageDe from "./images/hero-image-fg-de.svg";
import FgImageFr from "./images/hero-image-fg-fr.svg";
import { getLocale } from "../../functions/getLocale";
import { useL10n } from "../../hooks/l10n";

export type Props = {
  premium?: boolean;
};

/**
 * Image of a phone showing the Relay interface, either the Premium or regular UI as desired.
 */

export const DemoPhone = (props: Props) => {
  const l10n = useL10n();
  const lang = getLocale(l10n).split("-")[0] ?? "en";

  const getScreenshotImage = (
    isPremium: boolean,
    lang: string
  ): StaticImageData => {
    if (lang === "fr") {
      return PremiumScreenshotFr;
    }
    if (lang === "de") {
      return PremiumScreenshotDe;
    }
    // If Premium is not availabe in the country,
    // show no premium demo phone state
    if (!isPremium) {
      return NoPremiumScreenshot;
    }
    return PremiumScreenshot;
  };

  const getForegroundImage = (lang: string): StaticImageData => {
    if (lang === "fr") {
      return FgImageFr;
    }
    if (lang === "de") {
      return FgImageDe;
    }
    return FgImage;
  };

  return (
    <div className={styles.container}>
      <Image src={BgImage} alt="" className={styles.background} />

      <Image
        src={getScreenshotImage(props.premium ?? false, lang)}
        className={styles.phone}
        alt=""
      />
      <Image
        src={getForegroundImage(lang)}
        alt=""
        className={styles.foreground}
      />
    </div>
  );
};
