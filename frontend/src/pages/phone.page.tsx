import { NextPage } from "next";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./faq.module.scss";
import { Layout } from "../components/layout/Layout";
import { useGaViewPing } from "../hooks/gaViewPing";
import { LinkButton } from "../components/Button";
import { useProfiles } from "../hooks/api/profile";
import { useUsers } from "../hooks/api/user";
import { PhoneOnboarding } from "../components/dashboard/phones/PhoneOnboarding";

const Phone: NextPage = () => {
  const { l10n } = useLocalization();
  // const runtimeData = useRuntimeData();

  const profileData = useProfiles();
  const profile = profileData.data?.[0];

  const userData = useUsers();
  const user = userData.data?.[0];
  if (!profile || !user) {
    // TODO: Show a loading spinner?
    return null;
  }

  const onNextStep = (step: number) => {
    profileData.update(profile.id, {
      onboarding_state: step,
    });
  };

  return (
    <Layout>
      <PhoneOnboarding
        profile={profile}
        onNextStep={onNextStep}
        // onPickSubdomain={setCustomSubdomain}
      />
    </Layout>
  );
};

export default Phone;
