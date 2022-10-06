import { useLocalization } from "@fluent/react";
import styles from "./DemoPhone.module.scss";
import BgImage from "./images/hero-image-bg.svg";
import PremiumScreenshot from "./images/hero-image-premium.png";
import PremiumScreenshotFr from "./images/hero-image-premium-fr.png";
import PremiumScreenshotDe from "./images/hero-image-premium-de.png";
import NoPremiumScreenshot from "./images/hero-image-nopremium.svg";
import FgImage from "./images/hero-image-fg.svg";
import FgImageDe from "./images/hero-image-fg-de.svg";
import FgImageFr from "./images/hero-image-fg-fr.svg";
import { getLocale } from "../../functions/getLocale";

export type Props = {
  premium?: boolean;
};

/**
 * Image of a phone showing the Relay interface, either the Premium or regular UI as desired.
 */
export const DemoPhone = (props: Props) => {
  const { l10n } = useLocalization();
  const lang = getLocale(l10n).split("-")[0] ?? "en";

  return (
    <div className={styles.container}>
      <img src={BgImage.src} alt="" className={styles.background} />
      <img
        src={getScreenshotUrl(props.premium ?? false, lang)}
        className={styles.phone}
        alt=""
      />
      <img src={getForegroundUrl(lang)} alt="" className={styles.foreground} />
    </div>
  );
};

function getScreenshotUrl(isPremium: boolean, lang: string): string {
  if (isPremium) {
    if (lang === "fr") {
      return PremiumScreenshotFr.src;
    }
    if (lang === "de") {
      return PremiumScreenshotDe.src;
    }
    return PremiumScreenshot.src;
  }
  return NoPremiumScreenshot.src;
}

function getForegroundUrl(lang: string): string {
  if (lang === "fr") {
    return FgImageFr.src;
  }
  if (lang === "de") {
    return FgImageDe.src;
  }
  return FgImage.src;
}
