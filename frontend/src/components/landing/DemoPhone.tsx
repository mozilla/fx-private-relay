import { useLocalization } from "@fluent/react";
import styles from "./DemoPhone.module.scss";
import BgImage from "../../../../static/images/newlanding/a/hero-image-bg.svg";
import PremiumScreenshot from "../../../../static/images/newlanding/a/hero-image-premium.svg";
import PremiumScreenshotFr from "../../../../static/images/newlanding/a/hero-image-premium-fr.svg";
import PremiumScreenshotDe from "../../../../static/images/newlanding/a/hero-image-premium-de.svg";
import NoPremiumScreenshot from "../../../../static/images/newlanding/a/hero-image-nopremium.svg";
import FgImage from "../../../../static/images/newlanding/a/hero-image-fg.svg";
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

  return (
    <div className={styles.container}>
      <img src={BgImage.src} alt="" className={styles.background} />
      <img src={screenshot} alt="" />
      <img src={FgImage.src} alt="" className={styles.foreground} />
    </div>
  );
};
