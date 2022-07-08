import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./InterviewRecruitment.module.scss";
import { ProfileData } from "../../../hooks/api/profile";
import { CloseIcon } from "../../Icons";
import { useLocalDismissal } from "../../../hooks/localDismissal";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import { getLocale } from "../../../functions/getLocale";
import { useRouter } from "next/router";

export type Props = {
  profile?: ProfileData;
};

/**
 * Ask people whether they're be interested in discussing their experience in using Relay.
 */
export const InterviewRecruitment = (props: Props) => {
  const router = useRouter();
  const recruitmentLink =
    "https://survey.alchemer-ca.com/s3/50148495/Mozilla-User-Research-2022-05";
  const recruitmentLabel =
    "We want to learn more about your experience with Firefox Relay. Research participants receive a $100 Amazon giftcard. Learn more.";

  const { l10n } = useLocalization();
  const dismissal = useLocalDismissal("interview-recruitment-2022-05");
  const runtimeData = useRuntimeData();
  const linkRef = useGaViewPing({
    category: "Recruitment",
    label: recruitmentLabel,
  });

  // Only show if...
  if (
    // ...the user is currently looking at the dashboard,
    router.pathname !== "/accounts/profile" ||
    // ...the user hasn't closed the recruitment banner before,
    dismissal.isDismissed ||
    // ...the user is logged in,
    !props.profile ||
    // ...the user is located in the Canada, Germany, France, the UK, or the US, and
    !["ca", "de", "fr", "gb", "us"].includes(
      runtimeData.data?.PREMIUM_PLANS.country_code ?? "not the user's country"
    ) ||
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
        className={styles["dismiss-button"]}
        onClick={() => dismissal.dismiss()}
        title={l10n.getString("survey-option-dismiss")}
      >
        <CloseIcon alt={l10n.getString("survey-option-dismiss")} />
      </button>
    </aside>
  );
};
