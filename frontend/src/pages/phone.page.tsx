import { NextPage } from "next";
import { Layout } from "../components/layout/Layout";
import { useProfiles } from "../hooks/api/profile";
import { useUsers } from "../hooks/api/user";
import { PhoneOnboarding } from "../components/phones/onboarding/PhoneOnboarding";
import { useRelayNumber } from "../hooks/api/relayNumber";
import { useEffect, useState } from "react";
import { PhoneDashboard } from "../components/phones/dashboard/Dashboard";
import { getRuntimeConfig } from "../config";

const Phone: NextPage = () => {
  const profileData = useProfiles();
  const profile = profileData.data?.[0];

  const userData = useUsers();
  const user = userData.data?.[0];

  const relayNumberData = useRelayNumber();
  const [isInOnboarding, setIsInOnboarding] = useState<boolean>();

  useEffect(() => {
    if (
      typeof isInOnboarding === "undefined" &&
      Array.isArray(relayNumberData.data) &&
      relayNumberData.data.length === 0
    ) {
      setIsInOnboarding(true);
    }
  }, [isInOnboarding, relayNumberData]);

  if (!userData.isValidating && userData.error) {
    document.location.assign(getRuntimeConfig().fxaLoginUrl);
  }

  if (!profile || !user || !relayNumberData.data) {
    // TODO: Show a loading spinner?
    return null;
  }

  if (isInOnboarding || relayNumberData.data.length === 0) {
    return (
      <Layout>
        <PhoneOnboarding onComplete={() => setIsInOnboarding(false)} />
      </Layout>
    );
  }

  return (
    <Layout>
      <PhoneDashboard />
    </Layout>
  );
};

export default Phone;
