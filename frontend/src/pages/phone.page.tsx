import { NextPage } from "next";
import { Layout } from "../components/layout/Layout";
import { useProfiles } from "../hooks/api/profile";
import { useUsers } from "../hooks/api/user";
import { PhoneOnboarding } from "../components/phones/onboarding/PhoneOnboarding";

const Phone: NextPage = () => {
  const profileData = useProfiles();
  const profile = profileData.data?.[0];

  const userData = useUsers();
  const user = userData.data?.[0];
  if (!profile || !user) {
    // TODO: Show a loading spinner?
    return null;
  }

  return (
    <Layout>
      <PhoneOnboarding />
    </Layout>
  );
};

export default Phone;
