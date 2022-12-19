import { event as gaEvent } from "react-ga";
import styles from "./NpsSurvey.module.scss";
import { useFirstSeen } from "../../../hooks/firstSeen";
import { useLocalDismissal } from "../../../hooks/localDismissal";
import { useIsLoggedIn } from "../../../hooks/session";
import { useProfiles } from "../../../hooks/api/profile";
import { CloseIcon } from "../../Icons";
import { useL10n } from "../../../hooks/l10n";

/**
 * Quickly survey the user for input to our Net Promotor Score.
 *
 * @deprecated We'll replace this with {@link CsatSurvey}.
 */
export const NpsSurvey = () => {
  const profileData = useProfiles();
  const dismissal = useLocalDismissal(
    "nps-survey_" + profileData.data?.[0].id,
    { duration: 30 * 24 * 60 * 60 }
  );
  const firstSeen = useFirstSeen();
  const isLoggedIn = useIsLoggedIn();
  const l10n = useL10n();

  const hasBeenUserForThreeDays =
    isLoggedIn &&
    firstSeen instanceof Date &&
    Date.now() - firstSeen.getTime() > 3 * 24 * 60 * 60;

  // TODO: Show if either the user has been one for three days,
  // *or* they've been a Premium customer for three days:
  if (dismissal.isDismissed || !hasBeenUserForThreeDays) {
    return null;
  }

  const submit = (likelihood: number) => {
    dismissal.dismiss();
    let label = "passive";
    let npsValue = 0;
    if (likelihood <= 6) {
      label = "detractor";
      npsValue = -1;
    }
    if (likelihood >= 9) {
      label = "promoter";
      npsValue = 1;
    }
    gaEvent({
      category: "NPS Survey",
      action: "submitted",
      label: label,
      value: likelihood,
      dimension1: label,
      metric1: 1,
      metric2: likelihood,
      metric3: npsValue,
    });
  };

  return (
    <aside className={styles.wrapper}>
      <div className={styles.prompt}>{l10n.getString("survey-question-1")}</div>
      <div className={styles.scale}>
        <span aria-hidden={true} className={styles.legend}>
          {l10n.getString("survey-option-not-likely")}
        </span>
        <ol>
          <li>
            <button className={styles.likelihood} onClick={() => submit(1)}>
              1
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(2)}>
              2
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(3)}>
              3
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(4)}>
              4
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(5)}>
              5
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(6)}>
              6
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(7)}>
              7
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(8)}>
              8
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(9)}>
              9
            </button>
          </li>
          <li>
            <button className={styles.likelihood} onClick={() => submit(10)}>
              10
            </button>
          </li>
        </ol>
        <span aria-hidden={true} className={styles.legend}>
          {l10n.getString("survey-option-very-likely")}
        </span>
      </div>
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
