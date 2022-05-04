import { useLocalization } from "@fluent/react";
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

export type Props = {
  premium?: boolean;
};

/**
 * Image of a phone showing the Relay interface, either the Premium or regular UI as desired.
 */
export const DemoPhone = (props: Props) => {
  const { l10n } = useLocalization();
  const lang = getLocale(l10n).split("-")[0] ?? "en";

  // Show an English-language non-Premium interface by default:
  let screenshot = NoPremiumScreenshot.src;
  if (props.premium) {
    // if Premium is available in the user's country,
    // show the English-language Premium interface:
    screenshot = PremiumScreenshot.src;
    if (lang === "fr") {
      // ...except if the user speaks French, in which case it will be localised in French:
      screenshot = PremiumScreenshotFr.src;
    }
    if (lang === "de") {
      // ...except if the user speaks German, in which case it will be localised in German:
      screenshot = PremiumScreenshotDe.src;
    }
  }
  let foreground = FgImage.src;
  if (lang === "fr") {
    foreground = FgImageFr.src;
  }
  if (lang === "de") {
    foreground = FgImageDe.src;
  }

  return (
    <div className={styles.container}>
      <img src={BgImage.src} alt="" className={styles.background} />
      <img src={screenshot} alt="" />
      <img src={foreground} alt="" className={styles.foreground} />
    </div>
  );
};
