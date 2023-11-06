import { event as gaEvent } from "react-ga";
import styles from "./CsatSurvey.module.scss";
import { useFirstSeen } from "../../../hooks/firstSeen";
import {
  DismissOptions,
  useLocalDismissal,
} from "../../../hooks/localDismissal";
import { ProfileData } from "../../../hooks/api/profile";
import { CloseIcon } from "../../Icons";
import { parseDate } from "../../../functions/parseDate";
import { useState } from "react";
import { getLocale } from "../../../functions/getLocale";
import { useL10n } from "../../../hooks/l10n";

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
/**
 * Quickly survey the user about their satisfaction with Relay, and invite them to share more information.
 */
export const CsatSurvey = (props: Props) => {
  const free7DaysDismissal = useLocalDismissal(
    "csat-survey-free-7days_" + props.profile.id,
  );
  const free30DaysDismissal = useLocalDismissal(
    "csat-survey-free-30days_" + props.profile.id,
  );
  const free90DaysDismissal = useLocalDismissal(
    "csat-survey-free-90days_" + props.profile.id,
    // After the third month, show every three months:
    { duration: 90 * 24 * 60 * 60 },
  );
  const premium7DaysDismissal = useLocalDismissal(
    "csat-survey-premium-7days_" + props.profile.id,
  );
  const premium30DaysDismissal = useLocalDismissal(
    "csat-survey-premium-30days_" + props.profile.id,
  );
  const premium90DaysDismissal = useLocalDismissal(
    "csat-survey-premium-90days_" + props.profile.id,
    // After the third month, show every three months:
    { duration: 90 * 24 * 60 * 60 },
  );
  const firstSeen = useFirstSeen();
  const l10n = useL10n();
  const [answer, setAnswer] = useState<keyof SurveyLinks>();

  let reasonToShow:
    | null
    | "free7days"
    | "free30days"
    | "free90days"
    | "premium7days"
    | "premium30days"
    | "premium90days" = null;

  if (
    props.profile.has_premium &&
    (props.profile.date_subscribed || firstSeen instanceof Date)
  ) {
    // There are two reasons why someone might not have a subscription date set:
    // - They subscribed before we started tracking that.
    // - They have Premium because they have a Mozilla email address.
    // In the latter case, their first visit date is effectively their
    // subscription date. In the former case, they will have had Premium for
    // a while, so they can be shown the survey too. Their first visit will
    // have been a while ago, so we'll just use that as a proxy for the
    // subscription date:
    const subscriptionDate = props.profile.date_subscribed
      ? parseDate(props.profile.date_subscribed)
      : // We've verified that `firstSeen` is a Date if `date_subscribed` is null
        // with instanceof above, but that logic is a bit too complex to allow
        // TypeScript to be able to narrow the type of `firstSeen` by inference,
        // hence the type assertion:
        (firstSeen as Date);
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
      free30DaysDismissal.dismiss(options);
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
      // Custom dimension 3 in Google Analytics is "CSAT Category",
      // i.e. "Dissatisfied", "Neutral" or "Satisfied"
      dimension3: getCategoryOfSatisfaction(satisfaction),
      // Custom dimension 3 in Google Analytics is "CSAT Survey Rating",
      // i.e. "Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied" or "Very Satisfied"
      dimension4: satisfaction,
      // Metric 10 in Google Analytics is "CSAT Survey Count",
      // i.e. it tracks how many people have completed the CSAT survey:
      metric10: 1,
      // Metric 11 in Google Analytics is "CSAT Survey Rating",
      // i.e. it tracks which answer survey takers gave ("Very Dissatisfied",
      // "Dissatisfied", "Neutral", "Satisfied" or "Very Satisfied")
      metric11: getNumericValueOfSatisfaction(satisfaction),
      // Metric 12 in Google Analytics is "CSAT Satisfaction Value",
      // i.e. it tracks where users are Satisfied, Neutral or Dissatisfied:
      metric12: getNumericValueOfSatisfactionCategory(
        getCategoryOfSatisfaction(satisfaction),
      ),
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
        className={styles["dismiss-button"]}
        onClick={() => dismiss()}
        title={l10n.getString("survey-option-dismiss")}
      >
        <CloseIcon alt={l10n.getString("survey-option-dismiss")} />
      </button>
    </aside>
  );
};

function getNumericValueOfSatisfaction(
  satisfaction: keyof SurveyLinks,
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

type SatisfactionCategory = "Dissatisfied" | "Neutral" | "Satisfied";
function getCategoryOfSatisfaction(
  satisfaction: keyof SurveyLinks,
): SatisfactionCategory {
  switch (satisfaction) {
    case "Very Dissatisfied":
    case "Dissatisfied":
      return "Dissatisfied";
    case "Neutral":
      return "Neutral";
    case "Satisfied":
    case "Very Satisfied":
      return "Satisfied";
  }
}

function getNumericValueOfSatisfactionCategory(
  satisfactionCategory: SatisfactionCategory,
): -1 | 0 | 1 {
  switch (satisfactionCategory) {
    case "Dissatisfied":
      return -1;
    case "Neutral":
      return 0;
    case "Satisfied":
      return 1;
  }
}
