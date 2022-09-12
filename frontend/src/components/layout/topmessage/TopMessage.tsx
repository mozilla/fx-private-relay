import { useLocalization } from "@fluent/react";
import { useRouter } from "next/router";
import { ProfileData } from "../../../hooks/api/profile";
import { InterviewRecruitment } from "./InterviewRecruitment";
import { CsatSurvey } from "./CsatSurvey";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { isFlagActive } from "../../../functions/waffle";
import { getLocale } from "../../../functions/getLocale";

export type Props = {
  profile?: ProfileData;
  runtimeData?: RuntimeData;
};

export const TopMessage = (props: Props) => {
  const { l10n } = useLocalization();
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
      props.runtimeData?.PREMIUM_PLANS.country_code ?? "not the user's country"
    ) &&
    // ...the user speaks English:
    getLocale(l10n).split("-")[0] === "en"
  ) {
    return <InterviewRecruitment />;
  }

  if (props.profile) {
    return <CsatSurvey profile={props.profile} />;
  }

  return null;
};
