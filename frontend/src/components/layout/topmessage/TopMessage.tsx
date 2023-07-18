import { useRouter } from "next/router";
import { ProfileData } from "../../../hooks/api/profile";
import { InterviewRecruitment } from "./InterviewRecruitment";
import { CsatSurvey } from "./CsatSurvey";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { isFlagActive } from "../../../functions/waffle";
import { getLocale } from "../../../functions/getLocale";
import { PhoneSurvey } from "./PhoneSurvey";
import { useL10n } from "../../../hooks/l10n";

export type Props = {
  profile?: ProfileData;
  runtimeData?: RuntimeData;
};

export const TopMessage = (props: Props) => {
  const l10n = useL10n();
  const router = useRouter();

  if (
    // Only show the Interview Recruitment banner if it's enabled,
    isFlagActive(props.runtimeData, "interview_recruitment") &&
    // ...the user is currently looking at the dashboard,
    router.pathname === "/accounts/profile" &&
    // ...the user is logged in,
    props.profile &&
    // ...the user is from the US, and...
    ["us"].includes(
      props.runtimeData?.PERIODICAL_PREMIUM_PLANS.country_code ??
        "not the user's country",
    ) &&
    // ...the user speaks English:
    getLocale(l10n).split("-")[0] === "en"
  ) {
    return <InterviewRecruitment />;
  }

  if (
    // Only show the Phone launch survey banner if it's enabled,
    isFlagActive(props.runtimeData, "phone_launch_survey") &&
    // ...the user is logged in,
    props.profile &&
    // ...the user has purchased the phone masking plan,
    props.profile.has_phone &&
    // ...the user is from the US or Canada, and...
    ["us", "ca"].includes(
      props.runtimeData?.PHONE_PLANS.country_code ?? "not the user's country",
    ) &&
    // ...the user speaks English:
    getLocale(l10n).split("-")[0] === "en"
  ) {
    return <PhoneSurvey />;
  }

  if (props.profile) {
    return <CsatSurvey profile={props.profile} />;
  }

  return null;
};
