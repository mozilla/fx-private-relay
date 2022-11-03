import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./PhoneSurvey.module.scss";
import { CloseIcon } from "../../Icons";
import { useLocalDismissal } from "../../../hooks/localDismissal";
import { useGaViewPing } from "../../../hooks/gaViewPing";

/**
 * Ask people whether they're be interested in discussing their experience in using Relay.
 */
export const PhoneSurvey = () => {
  const recruitmentLink =
    "https://survey.alchemer.com/s3/7088730/Firefox-Relay-Phone-Masking";
  // Only shown to English speakers, so unlocalised:
  const recruitmentLabel =
    "Answer 4 questions to help improve your experience.";

  const { l10n } = useLocalization();
  const dismissal = useLocalDismissal("phone-survey-2022-11");
  const linkRef = useGaViewPing({
    category: "Phone launch survey",
    label: recruitmentLabel,
  });

  // Only show if the user hasn't closed the recruitment banner before:
  if (dismissal.isDismissed) {
    return null;
  }

  return (
    <aside className={styles.wrapper}>
      <a
        href={recruitmentLink}
        ref={linkRef}
        onClick={() =>
          gaEvent({
            category: "Phone launch survey",
            action: "Engage",
            label: recruitmentLabel,
          })
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        {recruitmentLabel}
      </a>
      <button
        className={styles["dismiss-button"]}
        onClick={() => dismissal.dismiss()}
        title={l10n.getString("survey-option-dismiss")}
      >
        <CloseIcon alt={l10n.getString("survey-option-dismiss")} />
      </button>
    </aside>
  );
};
