import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./InterviewRecruitment.module.scss";
import { getRuntimeConfig } from "../../config";
import { ProfileData } from "../../hooks/api/profile";
import { CloseIcon } from "../Icons";
import { useLocalDismissal } from "../../hooks/localDismissal";
import { useRuntimeData } from "../../hooks/api/runtimeData";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { getLocale } from "../../functions/getLocale";

export type Props = {
  profile?: ProfileData;
};

/**
 * Ask people whether they're be interested in discussing their experience in using Relay.
 *
 * Only shown for people in the US who are signed in and haven't dismissed the
 * banner before.
 */
export const InterviewRecruitment = (props: Props) => {
  const recruitmentLink =
    "https://survey.alchemer.com/s3/6678255/Firefox-Relay-Research-Study";
  const recruitmentLabel =
    "Want to help improve Firefox Relay? We'd love to hear what you think. Research participants receive a $50  gift card.";

  const { l10n } = useLocalization();
  const dismissal = useLocalDismissal("interview-recruitment");
  const runtimeData = useRuntimeData();
  const linkRef = useGaViewPing({
    category: "Recruitment",
    label: recruitmentLabel,
  });

  // Only show if...
  if (
    // ...interview recruitment is enabled in the first place,
    getRuntimeConfig().featureFlags.interviewRecruitment !== true ||
    // ...the user hasn't closed the recruitment banner before,
    dismissal.isDismissed ||
    // ...the user is logged in,
    !props.profile ||
    // ...the user is located in the US, and
    runtimeData.data?.PREMIUM_PLANS.country_code !== "us" ||
    // ...the user speaks English.
    getLocale(l10n).split("-")[0] !== "en"
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
            category: "Recruitment",
            action: "Engage",
            label: recruitmentLabel,
          })
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* Only shown to English speakers, so unlocalised: */}
        {recruitmentLabel}
      </a>
      <button
        className={styles.dismissButton}
        onClick={() => dismissal.dismiss()}
        title={l10n.getString("survey-option-dismiss")}
      >
        <CloseIcon alt={l10n.getString("survey-option-dismiss")} />
      </button>
    </aside>
  );
};
