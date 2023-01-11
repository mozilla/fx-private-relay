import { event as gaEvent } from "react-ga";
import styles from "./PhoneSurvey.module.scss";
import { CloseIcon } from "../../Icons";
import { useLocalDismissal } from "../../../hooks/localDismissal";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import { useRelayNumber } from "../../../hooks/api/relayNumber";
import { useL10n } from "../../../hooks/l10n";

/**
 * Ask people whether they're be interested in discussing their experience in using Relay.
 */
export const PhoneSurvey = () => {
  const relayNumberData = useRelayNumber();
  const recruitmentLink =
    "https://survey.alchemer.com/s3/7088730/Firefox-Relay-Phone-Masking";
  // Only shown to English speakers, so unlocalised:
  const recruitmentLabel =
    "Answer 4 questions about phone masking to help improve your experience.";

  const l10n = useL10n();
  const dismissal = useLocalDismissal("phone-survey-2022-11");
  const linkRef = useGaViewPing({
    category: "Phone launch survey",
    label: recruitmentLabel,
  });

  // Only show if the user hasn't closed the recruitment banner before:
  if (dismissal.isDismissed) {
    return null;
  }

  // Don't show the banner if the user has subscribed to phone masking,
  // but has not claimed a Relay number yet:
  if (
    relayNumberData.error ||
    !Array.isArray(relayNumberData.data) ||
    relayNumberData.data.length === 0
  ) {
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
