import { NextPage } from "next";
import { Layout } from "../components/layout/Layout";
import { useProfiles } from "../hooks/api/profile";
import { useUsers } from "../hooks/api/user";
import { PhoneOnboarding } from "../components/phones/onboarding/PhoneOnboarding";
import { useRelayNumber } from "../hooks/api/relayNumber";
import { useEffect, useState } from "react";
import { PhoneDashboard } from "../components/phones/dashboard/Dashboard";
import { getRuntimeConfig } from "../config";
import { PurchasePhonesPlan } from "../components/phones/onboarding/PurchasePhonesPlan";
import { Banner } from "../components/Banner";
import styles from "./phone.module.scss";
import { useLocalization } from "@fluent/react";

const Phone: NextPage = () => {
  const profileData = useProfiles();
  const profile = profileData.data?.[0];
  const { l10n } = useLocalization();

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

  // show the phone plan purchase page if the user has not purchased phone product
  if (profile && user && !profile.has_phone) {
    return (
      <Layout>
        <PurchasePhonesPlan />
      </Layout>
    );
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
      <div className={styles["main-wrapper"]}>
        <div className={styles["banner-wrapper"]}>
          <Banner
            title={l10n.getString("phone-banner-resend-welcome-sms-title")}
            type="info"
            // TODO: add resend welcome SMS trigger here
            cta={{
              target: "/",
              content: l10n.getString("phone-banner-resend-welcome-sms-cta"),
              onClick: () => "",
              gaViewPing: {
                category: "Resend Welcome SMS",
                label: "phone-page-banner-resend-welcome",
              },
            }}
          >
            {l10n.getString("phone-banner-resend-welcome-sms-body")}
          </Banner>
        </div>
        <PhoneDashboard />
      </div>
    </Layout>
  );
};

export default Phone;
