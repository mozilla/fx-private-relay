import { Localized, useLocalization } from "@fluent/react";
import type { NextPage } from "next";
import styles from "./profile.module.scss";
import BottomBannerIllustration from "../../../../static/images/woman-couch-left.svg";
import checkIcon from "../../../../static/images/icon-check.svg";
import { Layout } from "../../components/layout/Layout";
import { useProfiles } from "../../hooks/api/profile";
import {
  AliasData,
  getAllAliases,
  isRandomAlias,
  useAliases,
} from "../../hooks/api/aliases";
import { useUsers } from "../../hooks/api/user";
import { AliasList } from "../../components/dashboard/aliases/AliasList";
import { SubdomainPicker } from "../../components/dashboard/SubdomainPicker";
import { toast } from "react-toastify";
import { ProfileBanners } from "../../components/dashboard/ProfileBanners";
import { LinkButton } from "../../components/Button";
import { usePremiumCountries } from "../../hooks/api/premiumCountries";
import {
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../../functions/getPlan";
import { useGaPing } from "../../hooks/gaPing";
import { trackPurchaseStart } from "../../functions/trackPurchase";
import { PremiumOnboarding } from "../../components/dashboard/PremiumOnboarding";
import { Onboarding } from "../../components/dashboard/Onboarding";
import { getRuntimeConfig } from "../../config";

const Profile: NextPage = () => {
  const profileData = useProfiles();
  const userData = useUsers();
  const { randomAliasData, customAliasData } = useAliases();
  const premiumCountriesData = usePremiumCountries();
  const { l10n } = useLocalization();
  const bottomBannerSubscriptionLinkRef = useGaPing({
    category: "Purchase Button",
    label: "profile-bottom-promo",
  });

  if (!userData.isValidating && userData.error) {
    document.location.assign(getRuntimeConfig().fxaLoginUrl);
  }

  const profile = profileData.data?.[0];
  const user = userData.data?.[0];
  if (!profile || !user || !randomAliasData.data || !customAliasData.data) {
    // TODO: Show a loading spinner?
    return null;
  }

  if (
    profile.has_premium &&
    profile.onboarding_state < getRuntimeConfig().maxOnboardingAvailable
  ) {
    const onNextStep = (step: number) => {
      profileData.update(profile.id, {
        onboarding_state: step,
      });
    };
    const onPickSubdomain = (subdomain: string) => {
      profileData.update(profile.id, { subdomain: subdomain });
    };

    return (
      <Layout>
        <PremiumOnboarding
          profile={profile}
          onNextStep={onNextStep}
          onPickSubdomain={onPickSubdomain}
        />
      </Layout>
    );
  }

  const createAlias = () => {
    randomAliasData.create();
  };

  const updateAlias = (alias: AliasData, updatedFields: Partial<AliasData>) => {
    if (isRandomAlias(alias)) {
      randomAliasData.update({ ...updatedFields, id: alias.id });
    } else {
      customAliasData.update({ ...updatedFields, id: alias.id });
    }
  };

  const deleteAlias = (alias: AliasData) => {
    if (isRandomAlias(alias)) {
      randomAliasData.delete(alias.id);
    } else {
      customAliasData.delete(alias.id);
    }
  };

  const allAliases = getAllAliases(randomAliasData.data, customAliasData.data);

  const totalBlockedEmails = allAliases.reduce(
    (count, alias) => count + alias.num_blocked,
    0
  );
  const totalForwardedEmails = allAliases.reduce(
    (count, alias) => count + alias.num_forwarded,
    0
  );

  const setCustomSubdomain = async (customSubdomain: string) => {
    const response = await profileData.update(profile.id, {
      subdomain: customSubdomain,
    });
    if (response.ok) {
      toast(
        l10n.getString("modal-domain-register-success", {
          subdomain: customSubdomain,
        }),
        { type: "success" }
      );
    }
  };

  const subdomainIndicator =
    typeof profile.subdomain === "string" ? (
      <strong className={styles.subdomain}>
        <img src={checkIcon.src} alt="" />
        {l10n.getString("profile-label-domain")}&nbsp; @{profile.subdomain}.
        {getRuntimeConfig().mozmailDomain}
      </strong>
    ) : null;

  // Non-Premium users have only five aliases, making the stats less insightful,
  // so only show them for Premium users:
  const stats = profile.has_premium ? (
    <header className={styles.header}>
      <div className={styles.headerWrapper}>
        <div className={styles.userDetails}>
          <Localized
            id="profile-label-welcome-html"
            vars={{
              email: user.email,
            }}
            elems={{
              span: <span className={styles.lead} />,
            }}
          >
            <span className={styles.greeting} />
          </Localized>
          {subdomainIndicator}
        </div>
        <div className={styles.accountStats}>
          <span className={styles.stat}>
            <span className={styles.label}>
              {l10n.getString("profile-stat-label-aliases-used")}
            </span>
            <span className={styles.value}>{allAliases.length}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.label}>
              {l10n.getString("profile-stat-label-blocked")}
            </span>
            <span className={styles.value}>{totalBlockedEmails}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.label}>
              {l10n.getString("profile-stat-label-forwarded")}
            </span>
            <span className={styles.value}>{totalForwardedEmails}</span>
          </span>
        </div>
      </div>
    </header>
  ) : (
    <Localized
      id="profile-label-welcome-html"
      vars={{ email: user.email }}
      elems={{ span: <span /> }}
    >
      <p className={styles.noPremiumHeader} />
    </Localized>
  );

  const bottomBanner =
    profile.has_premium ||
    !isPremiumAvailableInCountry(premiumCountriesData.data) ? null : (
      <div className={styles.bottomBanner}>
        <div className={styles.bottomBannerWrapper}>
          <div className={styles.bottomBannerContent}>
            <Localized
              id="banner-pack-upgrade-headline-html"
              elems={{ strong: <strong /> }}
            >
              <h3 />
            </Localized>
            <p>{l10n.getString("banner-pack-upgrade-copy")}</p>
            <LinkButton
              href={getPremiumSubscribeLink(premiumCountriesData.data)}
              ref={bottomBannerSubscriptionLinkRef}
              onClick={() =>
                trackPurchaseStart({ label: "profile-bottom-promo" })
              }
            >
              {l10n.getString("banner-pack-upgrade-cta")}
            </LinkButton>
          </div>
          <img src={BottomBannerIllustration.src} alt="" />
        </div>
      </div>
    );

  return (
    <>
      <Layout>
        {stats}
        <div className={styles.bannersWrapper}>
          <ProfileBanners profile={profile} />
        </div>
        <main className={styles.mainWrapper}>
          <SubdomainPicker profile={profile} onCreate={setCustomSubdomain} />
          <Onboarding aliases={allAliases} onCreate={createAlias} />
          <AliasList
            aliases={allAliases}
            onCreate={createAlias}
            onUpdate={updateAlias}
            onDelete={deleteAlias}
            profile={profile}
            user={user}
            premiumCountries={premiumCountriesData.data}
          />
          <p className={styles.sizeInformation}>
            {l10n.getString("profile-supports-email-forwarding", {
              size: getRuntimeConfig().emailSizeLimitNumber,
              unit: getRuntimeConfig().emailSizeLimitUnit,
            })}
          </p>
        </main>
        {bottomBanner}
      </Layout>
    </>
  );
};

export default Profile;
