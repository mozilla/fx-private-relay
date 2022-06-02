import { getRuntimeConfig } from "../../../config";
import { ProfileData } from "../../../hooks/api/profile";
import { InterviewRecruitment } from "./InterviewRecruitment";
import { CsatSurvey } from "./CsatSurvey";
import { NpsSurvey } from "./NpsSurvey";

export type Props = {
  profile?: ProfileData;
};

export const TopMessage = (props: Props) => {
  if (getRuntimeConfig().featureFlags.interviewRecruitment) {
    return <InterviewRecruitment profile={props.profile} />;
  }

  if (getRuntimeConfig().featureFlags.csatSurvey && props.profile) {
    return <CsatSurvey profile={props.profile} />;
  }

  return <NpsSurvey />;
};
