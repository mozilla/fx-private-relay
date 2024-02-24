import type { NextPage } from "next";
import Image from "next/image";
import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useRef,
  useState,
} from "react";
import {
  FocusScope,
  mergeProps,
  useButton,
  useOverlay,
  useOverlayPosition,
  useOverlayTrigger,
  useTooltip,
  useTooltipTrigger,
} from "react-aria";
import { useMenuTriggerState, useTooltipTriggerState } from "react-stately";
import { toast } from "react-toastify";
import styles from "./profile.module.scss";
import UpsellBannerUs from "./images/upsell-banner-us.svg";
import UpsellBannerNonUs from "./images/upsell-banner-nonus.svg";
import { CheckBadgeIcon, LockIcon, PencilIcon } from "../../components/Icons";
import { Layout } from "../../components/layout/Layout";
import { useProfiles } from "../../hooks/api/profile";
import {
  AliasData,
  getAllAliases,
  getFullAddress,
  useAliases,
} from "../../hooks/api/aliases";
import { useGaEvent } from "../../hooks/gaEvent";
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
import { useL10n } from "../../hooks/l10n";
import { Localized } from "../../components/Localized";
import { clearCookie, getCookie, setCookie } from "../../functions/cookies";
import { SubdomainInfoTooltip } from "../../components/dashboard/subdomain/SubdomainInfoTooltip";
import Link from "next/link";
import { FreeOnboarding } from "../../components/dashboard/FreeOnboarding";
import Confetti from "react-confetti";
import { useRouter } from "next/router";
import { CornerNotification } from "../../components/dashboard/CornerNotification";

const Profile: NextPage = () => {
  const runtimeData = useRuntimeData();
  const profileData = useProfiles();
  const userData = useUsers();
  const aliasData = useAliases();
  const addonData = useAddonData();
  const router = useRouter();
  const l10n = useL10n();
  const setCustomDomainLinkRef = useGaViewPing({
    category: "Purchase Button",
    label: "profile-set-custom-domain",
  });
  const gaEvent = useGaEvent();
  const hash = getCookie("profile-location-hash");
  if (hash) {
    document.location.hash = hash;
    clearCookie("profile-location-hash");
  }
  usePurchaseTracker(profileData.data?.[0]);
  const [modalOpened, setModalOpenedState] = useState(false);

  if (!userData.isValidating && userData.error) {
    if (document.location.hash) {
      setCookie("profile-location-hash", document.location.hash);
    }
    // Add url params to auth_params so django-allauth will send them to FXA
    const originalUrlParams = document.location.search.replace("?", "");
    const fxaLoginWithAuthParams =
      getRuntimeConfig().fxaLoginUrl +
      "&auth_params=" +
      encodeURIComponent(originalUrlParams);
    document.location.assign(fxaLoginWithAuthParams);
  }

  const profile = profileData.data?.[0];
  const user = userData.data?.[0];
  if (
    !runtimeData.data ||
    !profile ||
    !user ||
    !router ||
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

  // premium user onboarding experience
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

  const freeMaskLimit = getRuntimeConfig().maxFreeAliases;
  const freeMaskLimitReached =
    allAliases.length >= freeMaskLimit && !profile.has_premium;

  const createAlias = async (
    options:
      | { mask_type: "random" }
      | { mask_type: "custom"; address: string; blockPromotionals: boolean },
    setAliasGeneratedState?: (flag: boolean) => void,
  ) => {
    try {
      const response = await aliasData.create(options);
      if (!response.ok) {
        throw new Error(
          "Immediately caught to land in the same code path as failed requests.",
        );
      }
      if (setAliasGeneratedState) {
        setAliasGeneratedState(true);
      }
      addonData.sendEvent("aliasListUpdate");
    } catch (error) {
      // TODO: Refactor CustomAddressGenerationModal to remove the setAliasGeneratedState callback, and instead use a try catch block.
      setAliasGeneratedState
        ? setAliasGeneratedState(false)
        : toast(l10n.getString("error-mask-create-failed"), { type: "error" });

      // This is so we can catch the error when calling createAlias asynchronously and apply
      // more logic to handle when generating a mask fails.
      return Promise.reject("Mask generation failed");
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

  // We pull UTM parameters from query
  const {
    utm_campaign = "",
    utm_medium = "",
    utm_source = "",
  } = router.query || {};
  const isFreeUserOnboardingActive = isFlagActive(
    runtimeData.data,
    "free_user_onboarding",
  );

  // We validate UTM parameters to ensure they match the expected values for the onboarding campaign
  const isValidUtmParameters =
    utm_campaign === "relay-onboarding" &&
    utm_source === "relay-onboarding" &&
    utm_medium === "email";

  // Determine if the user is part of the target audience for onboarding
  // This checks if the user does not have a premium account and has not completed all onboarding steps
  const isOnboarding =
    profile.onboarding_free_state <
    getRuntimeConfig().maxOnboardingFreeAvailable;
  const isTargetAudience = !profile.has_premium && isOnboarding;

  // Conditions: onboarding is active, UTM parameters are valid OR the user has less than or equal to
  // 2 masks (if in onboarding process, up to 3), and the user is part of the target audience
  if (
    isFreeUserOnboardingActive &&
    (isValidUtmParameters ||
      allAliases.length <= 2 ||
      (profile.onboarding_free_state > 0 && allAliases.length <= 3)) &&
    isTargetAudience
  ) {
    const onNextStep = (step: number) => {
      profileData.update(profile.id, {
        onboarding_free_state: step,
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
          <FreeOnboarding
            profile={profile}
            onNextStep={onNextStep}
            onPickSubdomain={setCustomSubdomain}
            aliases={allAliases}
            generateNewMask={createAlias}
            hasReachedFreeMaskLimit={freeMaskLimitReached}
            user={user}
            runtimeData={runtimeData.data}
            onUpdate={updateAlias}
            hasAtleastOneMask={allAliases.length >= 1}
          />
        </Layout>
      </>
    );
  }

  const subdomainMessage =
    typeof profile.subdomain === "string" ? (
      <>
        <span>{l10n.getString("profile-label-custom-domain")}</span>
        <span className={styles["profile-registered-domain-value"]}>
          @{profile.subdomain}.{getRuntimeConfig().mozmailDomain}
        </span>
      </>
    ) : profile.has_premium ? (
      <a className={styles["open-button"]} href="#mpp-choose-subdomain">
        {l10n.getString("profile-label-set-your-custom-domain-free-user")}
      </a>
    ) : (
      <Link
        className={styles["open-button"]}
        href={"/premium#pricing"}
        ref={setCustomDomainLinkRef}
        onClick={() => {
          gaEvent({
            category: "Purchase Button",
            action: "Engage",
            label: "profile-set-custom-domain",
          });
        }}
      >
        {l10n.getString("profile-label-set-your-custom-domain-free-user")}
      </Link>
    );

  const numberFormatter = new Intl.NumberFormat(getLocale(l10n), {
    notation: "compact",
    compactDisplay: "short",
  });

  type TooltipProps = {
    children: ReactNode;
  };

  const MaxedMasksTooltip = (props: TooltipProps) => {
    const l10n = useL10n();
    const triggerState = useTooltipTriggerState({ delay: 0 });
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipTrigger = useTooltipTrigger({}, triggerState, triggerRef);
    const { tooltipProps } = useTooltip({}, triggerState);

    return (
      <div className={styles["stat-wrapper"]}>
        <span
          ref={triggerRef}
          {...tooltipTrigger.triggerProps}
          className={`${styles.stat} ${styles["forwarded-stat"]}`}
        >
          {props.children}
        </span>
        {triggerState.isOpen && (
          <div
            {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
            className={styles.tooltip}
          >
            <p>
              {l10n.getString("profile-maxed-aliases-tooltip", {
                limit: freeMaskLimit,
              })}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Show stats for free users and premium users
  const stats = (
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
            {/* render check badge if subdomain is set and user has premium
            render pencil icon if subdomain is not set but user has premium
            render lock icon by default */}
            {typeof profile.subdomain === "string" && profile.has_premium ? (
              <CheckBadgeIcon alt="" />
            ) : typeof profile.subdomain !== "string" && profile.has_premium ? (
              <PencilIcon alt="" className={styles["pencil-icon"]} />
            ) : (
              <LockIcon alt="" className={styles["lock-icon"]} />
            )}
            {subdomainMessage}
            <SubdomainInfoTooltip hasPremium={profile.has_premium} />
          </strong>
        </div>
        <dl className={styles["account-stats"]}>
          <div className={styles.stat}>
            <dt className={styles.label}>
              {l10n.getString("profile-stat-label-aliases-used-2")}
            </dt>
            {/* If premium is available in the user's country and 
            the user has reached their free mask limit and 
            they are a free user, show the maxed masks tooltip */}
            {isPeriodicalPremiumAvailableInCountry(runtimeData.data) &&
            freeMaskLimitReached ? (
              <dd className={`${styles.value} ${styles.maxed}`}>
                <MaxedMasksTooltip>
                  {numberFormatter.format(allAliases.length)}
                </MaxedMasksTooltip>
              </dd>
            ) : (
              <dd className={`${styles.value}`}>
                {numberFormatter.format(allAliases.length)}
              </dd>
            )}
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
  );

  const banners = (
    <section className={styles["banners-wrapper"]}>
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

  // Render the upsell banner when a user has reached the free mask limit
  const UpsellBanner = () => (
    <div className={styles["upsell-banner"]}>
      <div className={styles["upsell-banner-wrapper"]}>
        <div className={styles["upsell-banner-content"]}>
          <p className={styles["upsell-banner-header"]}>
            {isPhonesAvailableInCountry(runtimeData.data)
              ? l10n.getString("profile-maxed-aliases-with-phone-header")
              : l10n.getString("profile-maxed-aliases-without-phone-header")}
          </p>
          <p className={styles["upsell-banner-description"]}>
            {l10n.getString(
              isPhonesAvailableInCountry(runtimeData.data)
                ? "profile-maxed-aliases-with-phone-description"
                : "profile-maxed-aliases-without-phone-description",
              {
                limit: freeMaskLimit,
              },
            )}
          </p>
          <LinkButton
            href="/premium#pricing"
            ref={useGaViewPing({
              category: "Purchase Button",
              label: "upgrade-premium-header-mask-limit",
            })}
            onClick={() => {
              gaEvent({
                category: "Purchase Button",
                action: "Engage",
                label: "upgrade-premium-header-mask-limit",
              });
            }}
          >
            {l10n.getString("profile-maxed-aliases-cta")}
          </LinkButton>
        </div>
        <Image
          className={styles["upsell-banner-image"]}
          src={
            isPhonesAvailableInCountry(runtimeData.data)
              ? UpsellBannerUs
              : UpsellBannerNonUs
          }
          alt=""
        />
      </div>
    </div>
  );

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
      {/* Show confetti animation when user completes last step. */}
      {isFlagActive(runtimeData.data, "free_user_onboarding") &&
        !profile.has_premium &&
        profile.onboarding_free_state === 4 && (
          <Confetti
            tweenDuration={5000}
            gravity={0.2}
            recycle={false}
            onConfettiComplete={() => {
              // Update onboarding step to 4 - prevents animation from displaying again.
              profileData.update(profile.id, {
                onboarding_free_state: 5,
              });
            }}
          />
        )}
      <Layout isModalOpen={modalOpened} runtimeData={runtimeData.data}>
        {/* If free user has reached their free mask limit and 
        premium is available in their country, show upsell banner */}
        {freeMaskLimitReached &&
          isPeriodicalPremiumAvailableInCountry(runtimeData.data) && (
            <UpsellBanner />
          )}
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
              setModalOpenedState={setModalOpenedState}
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
        <CornerNotification
          profile={profile}
          runtimeData={runtimeData.data}
          aliases={allAliases}
        />
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
