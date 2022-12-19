import { event as gaEvent } from "react-ga";
import styles from "./InterviewRecruitment.module.scss";
import { CloseIcon } from "../../Icons";
import { useLocalDismissal } from "../../../hooks/localDismissal";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import { useL10n } from "../../../hooks/l10n";

/**
 * Ask people whether they're be interested in discussing their experience in using Relay.
 */
export const InterviewRecruitment = () => {
  const recruitmentLink =
    "https://survey.alchemer.com/s3/6963482/Firefox-Relay-Research-Study-h2-2022";
  // Only shown to English speakers, so unlocalised:
  const recruitmentLabel =
    "Want to help improve Firefox Relay? We'd love to hear what you think. Research participants receive a $50 gift card.";

  const l10n = useL10n();
  const dismissal = useLocalDismissal("interview-recruitment-2022-08");
  const linkRef = useGaViewPing({
    category: "Recruitment",
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
            category: "Recruitment",
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
