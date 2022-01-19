import { event as gaEvent } from "react-ga";
import styles from "./CsatSurvey.module.scss";
import { useFirstSeen } from "../../hooks/firstSeen";
import { DismissOptions, useLocalDismissal } from "../../hooks/localDismissal";
import { useLocalization } from "@fluent/react";
import { ProfileData } from "../../hooks/api/profile";
import { CloseIcon } from "../icons/close";
import { parseDate } from "../../functions/parseDate";
import { useState } from "react";

const surveyLinks = {
  "Very Dissatisfied": "https://survey.alchemer.com/s3/6665054/relaycsatvd",
  Dissatisfied: "https://survey.alchemer.com/s3/6665054/relaycsatd",
  Neutral: "https://survey.alchemer.com/s3/6665054/relaycsatn",
  Satisfied: "https://survey.alchemer.com/s3/6665054/relaycsats",
  "Very Satisfied": "https://survey.alchemer.com/s3/6665054/relaycsatvs",
};

type Props = {
  profile: ProfileData;
};
export const CsatSurvey = (props: Props) => {
  const free1WeekDismissal = useLocalDismissal(
    "csat-survey-free-1week_" + props.profile.id
  );
  const free1MonthDismissal = useLocalDismissal(
    "csat-survey-free-1month_" + props.profile.id
  );
  const free3MonthDismissal = useLocalDismissal(
    "csat-survey-free-3month_" + props.profile.id,
    // After the first month, show every three months:
    { duration: 30 * 24 * 60 * 60 }
  );
  const premium1WeekDismissal = useLocalDismissal(
    "csat-survey-premium-1week_" + props.profile.id
  );
  const premium1MonthDismissal = useLocalDismissal(
    "csat-survey-premium-1month_" + props.profile.id
  );
  const premium3MonthDismissal = useLocalDismissal(
    "csat-survey-premium-3month_" + props.profile.id,
    // After the first month, show every three months:
    { duration: 30 * 24 * 60 * 60 }
  );
  const firstSeen = useFirstSeen();
  const { l10n } = useLocalization();
  const [answer, setAnswer] = useState<keyof typeof surveyLinks>();

  let reasonToShow:
    | null
    | "free1week"
    | "free1month"
    | "free3month"
    | "premium1week"
    | "premium1month"
    | "premium3month" = null;

  if (props.profile.has_premium && props.profile.date_subscribed) {
    const subscriptionDate = parseDate(props.profile.date_subscribed);
    const daysSinceSubscription =
      (Date.now() - subscriptionDate.getTime()) / 1000 / 60 / 60 / 24;
    if (daysSinceSubscription >= 3 * 30) {
      if (!premium3MonthDismissal.isDismissed) {
        reasonToShow = "premium3month";
      }
    } else if (daysSinceSubscription >= 30) {
      if (!premium1MonthDismissal.isDismissed) {
        reasonToShow = "premium1month";
      }
    } else if (daysSinceSubscription >= 7) {
      if (!premium1WeekDismissal.isDismissed) {
        reasonToShow = "premium1week";
      }
    }
  } else if (!props.profile.has_premium && firstSeen instanceof Date) {
    const daysSinceFirstSeen =
      (Date.now() - firstSeen.getTime()) / 1000 / 60 / 60 / 24;
    if (daysSinceFirstSeen >= 3 * 30) {
      if (!free3MonthDismissal.isDismissed) {
        reasonToShow = "free3month";
      }
    } else if (daysSinceFirstSeen >= 30) {
      if (!free1MonthDismissal.isDismissed) {
        reasonToShow = "free1month";
      }
    } else if (daysSinceFirstSeen >= 7) {
      if (!free1WeekDismissal.isDismissed) {
        reasonToShow = "free1week";
      }
    }
  }

  if (reasonToShow === null) {
    return null;
  }

  const dismiss = (options?: DismissOptions) => {
    if (reasonToShow === "free1week") {
      free1WeekDismissal.dismiss(options);
    }
    if (reasonToShow === "free1month") {
      free3MonthDismissal.dismiss(options);
    }
    if (reasonToShow === "free3month") {
      free3MonthDismissal.dismiss(options);
    }
    if (reasonToShow === "premium1week") {
      premium1WeekDismissal.dismiss(options);
    }
    if (reasonToShow === "premium1month") {
      premium1MonthDismissal.dismiss(options);
    }
    if (reasonToShow === "premium3month") {
      premium3MonthDismissal.dismiss(options);
    }
  };

  const submit = (satisfaction: keyof typeof surveyLinks) => {
    setAnswer(satisfaction);
    dismiss({ soft: true });
    gaEvent({
      category: "CSAT Survey",
      action: "submitted",
      label: satisfaction,
    });
  };

  const question =
    typeof answer !== "undefined" ? (
      <div className={styles.prompt}>
        <a
          href={surveyLinks[answer]}
          onClick={() => dismiss()}
          target="_blank"
          rel="noopen noreferrer"
        >
          {l10n.getString("survey-csat-followup")}
        </a>
      </div>
    ) : (
      <>
        <div className={styles.prompt}>
          {l10n.getString("survey-csat-question")}
        </div>
        <div className={styles.answers}>
          <ol>
            <li>
              <button
                className={styles.answer}
                onClick={() => submit("Very Dissatisfied")}
              >
                {l10n.getString("survey-csat-answer-very-dissatisfied")}
              </button>
            </li>
            <li>
              <button
                className={styles.answer}
                onClick={() => submit("Dissatisfied")}
              >
                {l10n.getString("survey-csat-answer-dissatisfied")}
              </button>
            </li>
            <li>
              <button
                className={styles.answer}
                onClick={() => submit("Neutral")}
              >
                {l10n.getString("survey-csat-answer-neutral")}
              </button>
            </li>
            <li>
              <button
                className={styles.answer}
                onClick={() => submit("Satisfied")}
              >
                {l10n.getString("survey-csat-answer-satisfied")}
              </button>
            </li>
            <li>
              <button
                className={styles.answer}
                onClick={() => submit("Very Satisfied")}
              >
                {l10n.getString("survey-csat-answer-very-satisfied")}
              </button>
            </li>
          </ol>
        </div>
      </>
    );

  return (
    <aside className={styles.wrapper}>
      {question}
      <button
        className={styles.dismissButton}
        onClick={() => dismiss()}
        title={l10n.getString("survey-option-dismiss")}
      >
        <CloseIcon alt={l10n.getString("survey-option-dismiss")} />
      </button>
    </aside>
  );
};
