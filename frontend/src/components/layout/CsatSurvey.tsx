import { event as gaEvent } from "react-ga";
import styles from "./CsatSurvey.module.scss";
import { useFirstSeen } from "../../hooks/firstSeen";
import { DismissOptions, useLocalDismissal } from "../../hooks/localDismissal";
import { useLocalization } from "@fluent/react";
import { ProfileData } from "../../hooks/api/profile";
import { CloseIcon } from "../icons/close";
import { parseDate } from "../../functions/parseDate";
import { useState } from "react";
import { getLocale } from "../../functions/getLocale";

type SurveyLinks = {
  "Very Dissatisfied": string;
  Dissatisfied: string;
  Neutral: string;
  Satisfied: string;
  "Very Satisfied": string;
};
const surveyLinks: Record<"free" | "premium", SurveyLinks> = {
  free: {
    "Very Dissatisfied": "https://survey.alchemer.com/s3/6665054/4ffc17ee53cc",
    Dissatisfied: "https://survey.alchemer.com/s3/6665054/5c8a66981273",
    Neutral: "https://survey.alchemer.com/s3/6665054/a9f6fc6493de",
    Satisfied: "https://survey.alchemer.com/s3/6665054/1669a032ed19",
    "Very Satisfied": "https://survey.alchemer.com/s3/6665054/ba159b3a792f",
  },
  premium: {
    "Very Dissatisfied": "https://survey.alchemer.com/s3/6665054/2e10c92e6360",
    Dissatisfied: "https://survey.alchemer.com/s3/6665054/1961150a57d1",
    Neutral: "https://survey.alchemer.com/s3/6665054/e606b4a664d3",
    Satisfied: "https://survey.alchemer.com/s3/6665054/1fb00ea39755",
    "Very Satisfied": "https://survey.alchemer.com/s3/6665054/a957749b3de6",
  },
};

type Props = {
  profile: ProfileData;
};
export const CsatSurvey = (props: Props) => {
  const free7DaysDismissal = useLocalDismissal(
    "csat-survey-free-7days_" + props.profile.id
  );
  const free30DaysDismissal = useLocalDismissal(
    "csat-survey-free-30days_" + props.profile.id
  );
  const free90DaysDismissal = useLocalDismissal(
    "csat-survey-free-90days_" + props.profile.id,
    // After the third month, show every three months:
    { duration: 30 * 24 * 60 * 60 }
  );
  const premium7DaysDismissal = useLocalDismissal(
    "csat-survey-premium-7days_" + props.profile.id
  );
  const premium30DaysDismissal = useLocalDismissal(
    "csat-survey-premium-30days_" + props.profile.id
  );
  const premium90DaysDismissal = useLocalDismissal(
    "csat-survey-premium-90days_" + props.profile.id,
    // After the third month, show every three months:
    { duration: 30 * 24 * 60 * 60 }
  );
  const firstSeen = useFirstSeen();
  const { l10n } = useLocalization();
  const [answer, setAnswer] = useState<keyof SurveyLinks>();

  let reasonToShow:
    | null
    | "free7days"
    | "free30days"
    | "free90days"
    | "premium7days"
    | "premium30days"
    | "premium90days" = null;

  if (props.profile.has_premium && props.profile.date_subscribed) {
    const subscriptionDate = parseDate(props.profile.date_subscribed);
    const daysSinceSubscription =
      (Date.now() - subscriptionDate.getTime()) / 1000 / 60 / 60 / 24;
    if (daysSinceSubscription >= 90) {
      if (!premium90DaysDismissal.isDismissed) {
        reasonToShow = "premium90days";
      }
    } else if (daysSinceSubscription >= 30) {
      if (!premium30DaysDismissal.isDismissed) {
        reasonToShow = "premium30days";
      }
    } else if (daysSinceSubscription >= 7) {
      if (!premium7DaysDismissal.isDismissed) {
        reasonToShow = "premium7days";
      }
    }
  } else if (!props.profile.has_premium && firstSeen instanceof Date) {
    const daysSinceFirstSeen =
      (Date.now() - firstSeen.getTime()) / 1000 / 60 / 60 / 24;
    if (daysSinceFirstSeen >= 90) {
      if (!free90DaysDismissal.isDismissed) {
        reasonToShow = "free90days";
      }
    } else if (daysSinceFirstSeen >= 30) {
      if (!free30DaysDismissal.isDismissed) {
        reasonToShow = "free30days";
      }
    } else if (daysSinceFirstSeen >= 7) {
      if (!free7DaysDismissal.isDismissed) {
        reasonToShow = "free7days";
      }
    }
  }

  const locale = getLocale(l10n);
  if (
    reasonToShow === null ||
    !["en", "fr", "de"].includes(locale.split("-")[0])
  ) {
    return null;
  }

  const dismiss = (options?: DismissOptions) => {
    if (reasonToShow === "free7days") {
      free7DaysDismissal.dismiss(options);
    }
    if (reasonToShow === "free30days") {
      free90DaysDismissal.dismiss(options);
    }
    if (reasonToShow === "free90days") {
      free90DaysDismissal.dismiss(options);
    }
    if (reasonToShow === "premium7days") {
      premium7DaysDismissal.dismiss(options);
    }
    if (reasonToShow === "premium30days") {
      premium30DaysDismissal.dismiss(options);
    }
    if (reasonToShow === "premium90days") {
      premium90DaysDismissal.dismiss(options);
    }
  };

  const submit = (satisfaction: keyof SurveyLinks) => {
    setAnswer(satisfaction);
    dismiss({ soft: true });
    gaEvent({
      category: "CSAT Survey",
      action: "submitted",
      label: satisfaction,
      value: getNumericValueOfSatisfaction(satisfaction),
    });
  };

  const question =
    typeof answer !== "undefined" ? (
      <div className={styles.prompt}>
        <a
          href={
            props.profile.has_premium
              ? surveyLinks.premium[answer]
              : surveyLinks.free[answer]
          }
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

function getNumericValueOfSatisfaction(
  satisfaction: keyof SurveyLinks
): 1 | 2 | 3 | 4 | 5 {
  switch (satisfaction) {
    case "Very Dissatisfied":
      return 1;
    case "Dissatisfied":
      return 2;
    case "Neutral":
      return 3;
    case "Satisfied":
      return 4;
    case "Very Satisfied":
      return 5;
  }
}
