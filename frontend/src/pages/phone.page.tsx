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
import { useRealPhonesData } from "../hooks/api/realPhone";
import { DashboardSwitcher } from "../components/layout/navigation/DashboardSwitcher";
import { isFlagActive } from "../functions/waffle";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { useRouter } from "next/router";

const Phone: NextPage = () => {
  const runtimeData = useRuntimeData();
  const profileData = useProfiles();
  const profile = profileData.data?.[0];
  const { l10n } = useLocalization();
  const router = useRouter();

  const userData = useUsers();
  const user = userData.data?.[0];

  const relayNumberData = useRelayNumber();
  const [isInOnboarding, setIsInOnboarding] = useState<boolean>();
  const realPhoneData = useRealPhonesData();

  useEffect(() => {
    // check if phone flag is active - return to premium page if not.
    if (!isFlagActive(runtimeData.data, "phones")) {
      router.push("/premium");
    }
  }, [runtimeData.data, router]);

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
        <DashboardSwitcher />
        <PurchasePhonesPlan />
      </Layout>
    );
  }

  if (isInOnboarding || relayNumberData.data.length === 0) {
    return (
      <Layout>
        <DashboardSwitcher />
        <PhoneOnboarding onComplete={() => setIsInOnboarding(false)} />
      </Layout>
    );
  }

  return (
    <Layout>
      <DashboardSwitcher />
      <main className={styles["main-wrapper"]}>
        <div className={styles["banner-wrapper"]}>
          <Banner
            title={l10n.getString("phone-banner-resend-welcome-sms-title")}
            type="info"
            cta={{
              content: l10n.getString("phone-banner-resend-welcome-sms-cta"),
              onClick: () => realPhoneData.resendWelcomeSMS(),

              gaViewPing: {
                category: "Resend Welcome SMS",
                label: "phone-page-banner-resend-welcome",
              },
            }}
            dismissal={{
              key: `resend-sms-banner-${profile?.id}`,
            }}
          >
            {l10n.getString("phone-banner-resend-welcome-sms-body")}
          </Banner>
        </div>
        <PhoneDashboard />
      </main>
    </Layout>
  );
};

export default Phone;
