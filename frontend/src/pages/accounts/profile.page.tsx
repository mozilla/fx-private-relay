import type { NextPage } from "next";
import Image from "next/image";
import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useRef,
} from "react";
import {
  FocusScope,
  useButton,
  useOverlay,
  useOverlayPosition,
  useOverlayTrigger,
} from "react-aria";
import { useMenuTriggerState } from "react-stately";
import { toast } from "react-toastify";
import styles from "./profile.module.scss";
import BottomBannerIllustration from "../../../public/images/woman-couch-left.svg";
import { PencilIcon, CheckBadgeIcon } from "../../components/Icons";
import { Layout } from "../../components/layout/Layout";
import { useProfiles } from "../../hooks/api/profile";
import {
  AliasData,
  getAllAliases,
  getFullAddress,
  useAliases,
} from "../../hooks/api/aliases";
import { useUsers } from "../../hooks/api/user";
import { AliasList } from "../../components/dashboard/aliases/AliasList";
import { ProfileBanners } from "../../components/dashboard/ProfileBanners";
import { LinkButton } from "../../components/Button";
import { useRuntimeData } from "../../hooks/api/runtimeData";
import {
  isPeriodicalPremiumAvailableInCountry,
  isPhonesAvailableInCountry,
} from "../../functions/getPlan";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { PremiumOnboarding } from "../../components/dashboard/PremiumOnboarding";
import { Onboarding } from "../../components/dashboard/Onboarding";
import { getRuntimeConfig } from "../../config";
import { Tips } from "../../components/dashboard/tips/Tips";
import { getLocale } from "../../functions/getLocale";
import { AddonData } from "../../components/dashboard/AddonData";
import { useAddonData } from "../../hooks/addon";
import { CloseIcon } from "../../components/Icons";
import { isFlagActive } from "../../functions/waffle";
import { DashboardSwitcher } from "../../components/layout/navigation/DashboardSwitcher";
import { usePurchaseTracker } from "../../hooks/purchaseTracker";
import { PremiumPromoBanners } from "../../components/dashboard/PremiumPromoBanners";
import { useL10n } from "../../hooks/l10n";
import { Localized } from "../../components/Localized";
import { clearCookie, getCookie, setCookie } from "../../functions/cookies";
import { SubdomainInfoTooltip } from "../../components/dashboard/subdomain/SubdomainInfoTooltip";

const Profile: NextPage = () => {
  const runtimeData = useRuntimeData();
  const profileData = useProfiles();
  const userData = useUsers();
  const aliasData = useAliases();
  const addonData = useAddonData();
  const l10n = useL10n();
  const bottomBannerSubscriptionLinkRef = useGaViewPing({
    category: "Purchase Button",
    label: "profile-bottom-promo",
  });
  const hash = getCookie("profile-location-hash");
  if (hash) {
    document.location.hash = hash;
    clearCookie("profile-location-hash");
  }
  usePurchaseTracker(profileData.data?.[0]);

  if (!userData.isValidating && userData.error) {
    if (document.location.hash) {
      setCookie("profile-location-hash", document.location.hash);
    }
    document.location.assign(getRuntimeConfig().fxaLoginUrl);
  }

  const profile = profileData.data?.[0];
  const user = userData.data?.[0];
  if (
    !runtimeData.data ||
    !profile ||
    !user ||
    !aliasData.randomAliasData.data ||
    !aliasData.customAliasData.data
  ) {
    // TODO: Show a loading spinner?
    return null;
  }

  const setCustomSubdomain = async (customSubdomain: string) => {
    const response = await profileData.setSubdomain(customSubdomain);
    if (!response.ok) {
      toast(
        l10n.getString("error-subdomain-not-available-2", {
          unavailable_subdomain: customSubdomain,
        }),
        { type: "error" },
      );
    }
    addonData.sendEvent("subdomainClaimed", { subdomain: customSubdomain });
  };

  const allAliases = getAllAliases(
    aliasData.randomAliasData.data,
    aliasData.customAliasData.data,
  );

  if (
    profile.has_premium &&
    profile.onboarding_state < getRuntimeConfig().maxOnboardingAvailable
  ) {
    const onNextStep = (step: number) => {
      profileData.update(profile.id, {
        onboarding_state: step,
      });
    };

    return (
      <>
        <AddonData
          aliases={allAliases}
          profile={profile}
          runtimeData={runtimeData.data}
          totalBlockedEmails={profile.emails_blocked}
          totalForwardedEmails={profile.emails_forwarded}
          totalEmailTrackersRemoved={profile.level_one_trackers_blocked}
        />
        <Layout runtimeData={runtimeData.data}>
          {isPhonesAvailableInCountry(runtimeData.data) ? (
            <DashboardSwitcher />
          ) : null}
          <PremiumOnboarding
            profile={profile}
            onNextStep={onNextStep}
            onPickSubdomain={setCustomSubdomain}
          />
        </Layout>
      </>
    );
  }

  const createAlias = async (
    options:
      | { mask_type: "random" }
      | { mask_type: "custom"; address: string; blockPromotionals: boolean },
  ) => {
    try {
      const response = await aliasData.create(options);
      if (!response.ok) {
        throw new Error(
          "Immediately caught to land in the same code path as failed requests.",
        );
      }
      addonData.sendEvent("aliasListUpdate");
    } catch (error) {
      toast(l10n.getString("error-mask-create-failed"), { type: "error" });
    }
  };

  const updateAlias = async (
    alias: AliasData,
    updatedFields: Partial<AliasData>,
  ) => {
    try {
      const response = await aliasData.update(alias, updatedFields);
      if (!response.ok) {
        throw new Error(
          "Immediately caught to land in the same code path as failed requests.",
        );
      }
    } catch (error) {
      toast(
        l10n.getString("error-mask-update-failed", {
          alias: getFullAddress(alias),
        }),
        { type: "error" },
      );
    }
  };

  const deleteAlias = async (alias: AliasData) => {
    try {
      const response = await aliasData.delete(alias);
      if (!response.ok) {
        throw new Error(
          "Immediately caught to land in the same code path as failed requests.",
        );
      }
      addonData.sendEvent("aliasListUpdate");
    } catch (error: unknown) {
      toast(
        l10n.getString("error-mask-delete-failed", {
          alias: getFullAddress(alias),
        }),
        { type: "error" },
      );
    }
  };

  const subdomainMessage =
    typeof profile.subdomain === "string" ? (
      <>
        <span>{l10n.getString("profile-label-custom-domain")}</span>
        <span className={styles["profile-registered-domain-value"]}>
          @{profile.subdomain}.{getRuntimeConfig().mozmailDomain}
        </span>
      </>
    ) : (
      <>
        <a className={styles["open-button"]} href="#mpp-choose-subdomain">
          {l10n.getString("profile-label-set-your-custom-domain")}
        </a>
      </>
    );

  const numberFormatter = new Intl.NumberFormat(getLocale(l10n), {
    notation: "compact",
    compactDisplay: "short",
  });

  // Non-Premium users have only five aliases, making the stats less insightful,
  // so only show them for Premium users:
  const stats = profile.has_premium ? (
    <section className={styles.header}>
      <div className={styles["header-wrapper"]}>
        <div className={styles["user-details"]}>
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
          <strong className={styles.subdomain}>
            {typeof profile.subdomain === "string" ? (
              <CheckBadgeIcon alt="" />
            ) : (
              <PencilIcon alt="" className={styles["pencil-icon"]} />
            )}
            {subdomainMessage}
            <SubdomainInfoTooltip />
          </strong>
        </div>
        <dl className={styles["account-stats"]}>
          <div className={styles.stat}>
            <dt className={styles.label}>
              {l10n.getString("profile-stat-label-aliases-used-2")}
            </dt>
            <dd className={styles.value}>
              {numberFormatter.format(allAliases.length)}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.label}>
              {l10n.getString("profile-stat-label-blocked")}
            </dt>
            <dd className={styles.value}>
              {numberFormatter.format(profile.emails_blocked)}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.label}>
              {l10n.getString("profile-stat-label-forwarded")}
            </dt>
            <dd className={styles.value}>
              {numberFormatter.format(profile.emails_forwarded)}
            </dd>
          </div>
          {/*
            Only show tracker blocking stats if the back-end provides them:
          */}
          {isFlagActive(runtimeData.data, "tracker_removal") &&
            typeof profile.level_one_trackers_blocked === "number" && (
              <div className={styles.stat}>
                <dt className={styles.label}>
                  {l10n.getString("profile-stat-label-trackers-removed")}
                </dt>
                <dd className={styles.value}>
                  {numberFormatter.format(profile.level_one_trackers_blocked)}
                  <StatExplainer>
                    <p>
                      {l10n.getString(
                        "profile-stat-label-trackers-learn-more-part1",
                      )}
                    </p>
                    <p>
                      {l10n.getString(
                        "profile-stat-label-trackers-learn-more-part2-2",
                      )}
                    </p>
                  </StatExplainer>
                </dd>
              </div>
            )}
        </dl>
      </div>
    </section>
  ) : (
    <Localized
      id="profile-label-welcome-html"
      vars={{ email: user.email }}
      elems={{ span: <span /> }}
    >
      <section className={styles["no-premium-header"]} />
    </Localized>
  );

  const bottomPremiumSection =
    profile.has_premium ||
    !isPeriodicalPremiumAvailableInCountry(runtimeData.data) ? null : (
      <section className={styles["bottom-banner"]}>
        <div className={styles["bottom-banner-wrapper"]}>
          <div className={styles["bottom-banner-content"]}>
            {isPhonesAvailableInCountry(runtimeData.data) ? (
              <>
                <Localized
                  id="footer-banner-premium-promo-headine"
                  elems={{ strong: <strong />, i: <i /> }}
                >
                  <h3 />
                </Localized>
                <p>{l10n.getString("footer-banner-premium-promo-body")}</p>
              </>
            ) : (
              <>
                <Localized
                  id="banner-pack-upgrade-headline-2-html"
                  elems={{ strong: <strong /> }}
                >
                  <h3 />
                </Localized>
                <p>{l10n.getString("banner-pack-upgrade-copy-2")}</p>
              </>
            )}

            <LinkButton
              href="/premium#pricing"
              ref={bottomBannerSubscriptionLinkRef}
            >
              {l10n.getString("banner-pack-upgrade-cta")}
            </LinkButton>
          </div>
          <Image src={BottomBannerIllustration} alt="" />
        </div>
      </section>
    );

  const banners = (
    <section className={styles["banners-wrapper"]}>
      {!profile.has_premium &&
      isPeriodicalPremiumAvailableInCountry(runtimeData.data) &&
      isFlagActive(runtimeData.data, "premium_promo_banners") ? (
        <PremiumPromoBanners />
      ) : null}
      <ProfileBanners
        profile={profile}
        user={user}
        onCreateSubdomain={setCustomSubdomain}
        runtimeData={runtimeData.data}
        aliases={allAliases}
      />
    </section>
  );
  const topBanners = allAliases.length > 0 ? banners : null;
  const bottomBanners = allAliases.length === 0 ? banners : null;

  return (
    <>
      <AddonData
        aliases={allAliases}
        profile={profile}
        runtimeData={runtimeData.data}
        totalBlockedEmails={profile.emails_blocked}
        totalForwardedEmails={profile.emails_forwarded}
        totalEmailTrackersRemoved={profile.level_one_trackers_blocked}
      />
      <Layout runtimeData={runtimeData.data}>
        {isPhonesAvailableInCountry(runtimeData.data) ? (
          <DashboardSwitcher />
        ) : null}
        <main className={styles["profile-wrapper"]}>
          {stats}
          {topBanners}
          <section className={styles["main-wrapper"]}>
            <Onboarding
              aliases={allAliases}
              onCreate={() => createAlias({ mask_type: "random" })}
            />
            <AliasList
              aliases={allAliases}
              onCreate={createAlias}
              onUpdate={updateAlias}
              onDelete={deleteAlias}
              profile={profile}
              user={user}
              runtimeData={runtimeData.data}
            />
            <p className={styles["size-information"]}>
              {l10n.getString("profile-supports-email-forwarding", {
                size: getRuntimeConfig().emailSizeLimitNumber,
                unit: getRuntimeConfig().emailSizeLimitUnit,
              })}
            </p>
          </section>
          {bottomBanners}
        </main>
        <aside>{bottomPremiumSection}</aside>
        <Tips profile={profile} runtimeData={runtimeData.data} />
      </Layout>
    </>
  );
};

const StatExplainer = (props: { children: React.ReactNode }) => {
  const l10n = useL10n();
  const explainerState = useMenuTriggerState({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { triggerProps } = useOverlayTrigger(
    { type: "dialog" },
    explainerState,
    openButtonRef,
  );

  const openButtonProps = useButton(triggerProps, openButtonRef).buttonProps;
  const closeButtonProps = useButton(
    { onPress: explainerState.close },
    closeButtonRef,
  ).buttonProps;

  const positionProps = useOverlayPosition({
    targetRef: openButtonRef,
    overlayRef: overlayRef,
    placement: "bottom",
    // $spacing-sm is 8px:
    offset: 8,
    isOpen: explainerState.isOpen,
  }).overlayProps;

  return (
    <div
      className={`${styles["learn-more-wrapper"]} ${
        explainerState.isOpen ? styles["is-open"] : styles["is-closed"]
      }`}
    >
      <button
        {...openButtonProps}
        ref={openButtonRef}
        className={styles["open-button"]}
      >
        {l10n.getString("profile-stat-learn-more")}
      </button>
      {explainerState.isOpen && (
        <StatExplainerTooltip
          ref={overlayRef}
          overlayProps={{
            isOpen: explainerState.isOpen,
            isDismissable: true,
            onClose: explainerState.close,
          }}
          positionProps={positionProps}
        >
          <button
            ref={closeButtonRef}
            {...closeButtonProps}
            className={styles["close-button"]}
          >
            <CloseIcon alt={l10n.getString("profile-stat-learn-more-close")} />
          </button>
          {props.children}
        </StatExplainerTooltip>
      )}
    </div>
  );
};

type StatExplainerTooltipProps = {
  children: ReactNode;
  overlayProps: Parameters<typeof useOverlay>[0];
  positionProps: HTMLAttributes<HTMLDivElement>;
};
const StatExplainerTooltip = forwardRef<
  HTMLDivElement,
  StatExplainerTooltipProps
>(function StatExplainerTooltipWithForwardedRef(props, overlayRef) {
  const { overlayProps } = useOverlay(
    props.overlayProps,
    overlayRef as RefObject<HTMLDivElement>,
  );

  return (
    <FocusScope restoreFocus>
      <div
        {...overlayProps}
        {...props.positionProps}
        style={{
          ...props.positionProps.style,
          // Don't let `useOverlayPosition` handle the horizontal positioning,
          // as it will align the tooltip with the `.stat` element, whereas we
          // want it to span almost the full width on mobile:
          left: undefined,
          right: undefined,
        }}
        ref={overlayRef}
        className={styles["learn-more-tooltip"]}
      >
        {props.children}
      </div>
    </FocusScope>
  );
});

export default Profile;
