import { ProfileData } from "../../../hooks/api/profile";
import { InterviewRecruitment } from "./InterviewRecruitment";
import { CsatSurvey } from "./CsatSurvey";
import { NpsSurvey } from "./NpsSurvey";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { isFlagActive } from "../../../functions/waffle";

export type Props = {
  profile?: ProfileData;
  runtimeData?: RuntimeData;
};

export const TopMessage = (props: Props) => {
  if (isFlagActive(props.runtimeData, "interview_recruitment")) {
    return <InterviewRecruitment profile={props.profile} />;
  }

  if (props.profile) {
    return <CsatSurvey profile={props.profile} />;
  }

  return <NpsSurvey />;
};
