import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useRef,
} from "react";
import {
  DismissButton,
  FocusScope,
  mergeProps,
  OverlayContainer,
  useButton,
  useDialog,
  useModal,
  useOverlay,
  useOverlayPosition,
  useOverlayTrigger,
} from "react-aria";
import { useOverlayTriggerState } from "react-stately";
import { event as gaEvent } from "react-ga";
import { StaticImageData } from "next/image";
import styles from "./WhatsNewMenu.module.scss";
import SizeLimitHero from "./images/size-limit-hero-10mb.svg";
import SizeLimitIcon from "./images/size-limit-icon-10mb.svg";
import SignBackInHero from "./images/sign-back-in-hero.svg";
import SignBackInIcon from "./images/sign-back-in-icon.svg";
import ForwardSomeHero from "./images/forward-some-hero.svg";
import ForwardSomeIcon from "./images/forward-some-icon.svg";
import aliasToMaskHero from "./images/alias-to-mask-hero.svg";
import aliasToMaskIcon from "./images/alias-to-mask-icon.svg";
import TrackerRemovalHero from "./images/tracker-removal-hero.svg";
import TrackerRemovalIcon from "./images/tracker-removal-icon.svg";
import PremiumSwedenHero from "./images/premium-expansion-sweden-hero.svg";
import PremiumSwedenIcon from "./images/premium-expansion-sweden-icon.svg";
import PremiumFinlandHero from "./images/premium-expansion-finland-hero.svg";
import PremiumFinlandIcon from "./images/premium-expansion-finland-icon.svg";
import PhoneMaskingHero from "./images/phone-masking-hero.svg";
import PhoneMaskingIcon from "./images/phone-masking-icon.svg";
import BundleHero from "./images/bundle-promo-hero.svg";
import BundleIcon from "./images/bundle-promo-icon.svg";
import OfferCountdownIcon from "./images/offer-countdown-icon.svg";
import FirefoxIntegrationHero from "./images/firefox-integration-hero.svg";
import FirefoxIntegrationIcon from "./images/firefox-integration-icon.svg";
import { WhatsNewComponentContent, WhatsNewContent } from "./WhatsNewContent";
import {
  DismissalData,
  useLocalDismissal,
} from "../../../../hooks/localDismissal";
import { ProfileData } from "../../../../hooks/api/profile";
import { WhatsNewDashboard } from "./WhatsNewDashboard";
import { useAddonData } from "../../../../hooks/addon";
import { isUsingFirefox } from "../../../../functions/userAgent";
import { getLocale } from "../../../../functions/getLocale";
import { RuntimeData } from "../../../../hooks/api/runtimeData";
import { isFlagActive } from "../../../../functions/waffle";
import {
  getBundlePrice,
  isBundleAvailableInCountry,
  isPeriodicalPremiumAvailableInCountry,
  isPhonesAvailableInCountry,
} from "../../../../functions/getPlan";
import { CountdownTimer } from "../../../CountdownTimer";
import Link from "next/link";
import { GiftIcon } from "../../../Icons";
import { useL10n } from "../../../../hooks/l10n";
import { VisuallyHidden } from "../../../VisuallyHidden";

export type WhatsNewEntry = {
  title: string;
  snippet: string;
  content: ReactNode;
  icon: StaticImageData;
  dismissal: DismissalData;
  /**
   * This is used to automatically archive entries of a certain age
   */
  announcementDate: {
    year: number;
    // Spelled out just to make sure it's clear we're not using 0-based months.
    // Thanks, JavaScript...
    month: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    day: number;
  };
};

export type Props = {
  profile: ProfileData;
  style: string;
  runtimeData?: RuntimeData;
};

type CtaProps = {
  link?: string;
  label: string;
  subscribed?: boolean;
};

const CtaLinkButton = (props: CtaProps) => {
  const hasSubscription = props.subscribed;

  return (
    <>
      {!hasSubscription ? (
        <Link href="/premium#pricing" legacyBehavior>
          <span className={styles.cta}>{props.label}</span>
        </Link>
      ) : null}
    </>
  );
};

export const WhatsNewMenu = (props: Props) => {
  const l10n = useL10n();

  const triggerState = useOverlayTriggerState({
    onOpenChange(isOpen) {
      gaEvent({
        category: "News",
        action: isOpen ? "Open" : "Close",
        label: "header-nav",
      });
    },
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const addonData = useAddonData();

  const entries: WhatsNewEntry[] = [
    {
      title: l10n.getString("whatsnew-feature-size-limit-heading"),
      snippet: l10n.getString("whatsnew-feature-size-limit-snippet-var", {
        size: 10,
        unit: "MB",
      }),
      content: (
        <WhatsNewContent
          description={l10n.getString(
            "whatsnew-feature-size-limit-description-var",
            {
              size: 10,
              unit: "MB",
            }
          )}
          heading={l10n.getString("whatsnew-feature-size-limit-heading")}
          image={SizeLimitHero}
          videos={{
            // Unfortunately video files cannot currently be imported, so make
            // sure these files are present in /public. See
            // https://github.com/vercel/next.js/issues/35248
            "video/webm; codecs='vp9'":
              "/animations/whatsnew/size-limit-hero-10mb.webm",
            "video/mp4": "/animations/whatsnew/size-limit-hero-10mb.mp4",
          }}
        />
      ),
      icon: SizeLimitIcon,
      dismissal: useLocalDismissal(
        `whatsnew-feature_size-limit_${props.profile.id}`
      ),
      announcementDate: {
        year: 2022,
        month: 3,
        day: 1,
      },
    },
  ];

  const forwardSomeEntry: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-forward-some-heading"),
    snippet: l10n.getString("whatsnew-feature-forward-some-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-forward-some-description"
        )}
        heading={l10n.getString("whatsnew-feature-forward-some-heading")}
        image={ForwardSomeHero}
      />
    ),
    icon: ForwardSomeIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_sign-back-in_${props.profile.id}`
    ),
    announcementDate: {
      year: 2022,
      month: 3,
      day: 1,
    },
  };
  if (props.profile.has_premium) {
    entries.push(forwardSomeEntry);
  }

  const signBackInEntry: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-sign-back-in-heading"),
    snippet: l10n.getString("whatsnew-feature-sign-back-in-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-sign-back-in-description"
        )}
        heading={l10n.getString("whatsnew-feature-sign-back-in-heading")}
        image={SignBackInHero}
      />
    ),
    icon: SignBackInIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_sign-back-in_${props.profile.id}`
    ),
    announcementDate: {
      year: 2022,
      month: 2,
      day: 1,
    },
  };
  if (addonData.present && isUsingFirefox()) {
    entries.push(signBackInEntry);
  }

  const aliasToMask: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-alias-to-mask-heading"),
    snippet: l10n.getString("whatsnew-feature-alias-to-mask-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-alias-to-mask-description"
        )}
        heading={l10n.getString("whatsnew-feature-alias-to-mask-heading")}
        image={aliasToMaskHero}
      />
    ),
    icon: aliasToMaskIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_alias-to-mask_${props.profile.id}`
    ),
    announcementDate: {
      year: 2022,
      month: 4,
      day: 19,
    },
  };
  // Not all localisations transitioned from "alias" to "mask", so only show this
  // announcement for those of which we _know_ did:
  if (
    [
      "en",
      "en-gb",
      "nl",
      "fy-nl",
      "zh-tw",
      "es-es",
      "es-mx",
      "de",
      "pt-br",
      "sv-se",
      "el",
      "hu",
      "sk",
      "skr",
      "uk",
    ].includes(getLocale(l10n).toLowerCase())
  ) {
    entries.push(aliasToMask);
  }

  const premiumInSweden: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-premium-expansion-sweden-heading"),
    snippet: l10n.getString("whatsnew-feature-premium-expansion-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-premium-expansion-description"
        )}
        heading={l10n.getString(
          "whatsnew-feature-premium-expansion-sweden-heading"
        )}
        image={PremiumSwedenHero}
      />
    ),
    icon: PremiumSwedenIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_premium-expansion-sweden_${props.profile.id}`
    ),
    announcementDate: {
      year: 2022,
      month: 5,
      day: 17,
    },
  };
  if (
    props.runtimeData?.PERIODICAL_PREMIUM_PLANS.country_code.toLowerCase() ===
      "se" &&
    !props.profile.has_premium
  ) {
    entries.push(premiumInSweden);
  }

  const premiumInFinland: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-premium-expansion-finland-heading"),
    snippet: l10n.getString("whatsnew-feature-premium-expansion-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-premium-expansion-description"
        )}
        heading={l10n.getString(
          "whatsnew-feature-premium-expansion-finland-heading"
        )}
        image={PremiumFinlandHero}
      />
    ),
    icon: PremiumFinlandIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_premium-expansion-finland_${props.profile.id}`
    ),
    announcementDate: {
      year: 2022,
      month: 5,
      day: 17,
    },
  };
  if (
    props.runtimeData?.PERIODICAL_PREMIUM_PLANS.country_code.toLowerCase() ===
      "fi" &&
    !props.profile.has_premium
  ) {
    entries.push(premiumInFinland);
  }

  const trackerRemoval: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-tracker-removal-heading"),
    snippet: l10n.getString("whatsnew-feature-tracker-removal-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-tracker-removal-description-2"
        )}
        heading={l10n.getString("whatsnew-feature-tracker-removal-heading")}
        image={TrackerRemovalHero}
      />
    ),
    icon: TrackerRemovalIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_tracker-removal_${props.profile.id}`
    ),
    announcementDate: {
      year: 2022,
      month: 8,
      day: 16,
    },
  };
  // Only show its announcement if tracker removal is live:
  if (isFlagActive(props.runtimeData, "tracker_removal")) {
    entries.push(trackerRemoval);
  }

  const endDateFormatter = new Intl.DateTimeFormat(getLocale(l10n), {
    dateStyle: "long",
  });
  // Introductory pricing ended 2022-09-27T09:00:00.000-07:00:
  const introPricingOfferEndDate = new Date(1664294400000);

  const introPricingCountdown: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-offer-countdown-heading"),
    snippet: l10n.getString("whatsnew-feature-offer-countdown-snippet", {
      end_date: endDateFormatter.format(introPricingOfferEndDate),
    }),
    content: (
      <WhatsNewComponentContent
        description={l10n.getString(
          "whatsnew-feature-offer-countdown-description",
          { end_date: endDateFormatter.format(introPricingOfferEndDate) }
        )}
        heading={l10n.getString("whatsnew-feature-offer-countdown-heading")}
        hero={
          <div className={styles["countdown-timer"]}>
            <CountdownTimer remainingTimeInMs={0} />
          </div>
        }
      />
    ),
    icon: OfferCountdownIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_offer-countdown_${props.profile.id}`
    ),
    announcementDate: {
      year: 2022,
      month: 9,
      day: 13,
    },
  };
  // Make sure to move the end-of-intro-pricing news entry is in the History
  // tab now that the countdown has finished:
  introPricingCountdown.dismissal.isDismissed = true;
  if (
    // If the user does not have Premium yet,
    !props.profile.has_premium &&
    // …but is able to purchase Premium
    isPeriodicalPremiumAvailableInCountry(props.runtimeData)
  ) {
    entries.push(introPricingCountdown);
  }

  const phoneAnnouncement: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-phone-header"),
    snippet: l10n.getString("whatsnew-feature-phone-snippet"),
    content:
      props.runtimeData && isPhonesAvailableInCountry(props.runtimeData) ? (
        <WhatsNewContent
          description={l10n.getString("whatsnew-feature-phone-description")}
          heading={l10n.getString("whatsnew-feature-phone-header")}
          image={PhoneMaskingHero}
          videos={{
            // Unfortunately video files cannot currently be imported, so make
            // sure these files are present in /public. See
            // https://github.com/vercel/next.js/issues/35248
            "video/webm; codecs='vp9'":
              "/animations/whatsnew/phone-masking-hero.webm",
            "video/mp4": "/animations/whatsnew/phone-masking-hero.mp4",
          }}
          cta={
            <CtaLinkButton
              subscribed={props.profile.has_phone}
              label={l10n.getString("whatsnew-feature-phone-upgrade-cta")}
            />
          }
        />
      ) : null,

    icon: PhoneMaskingIcon,
    dismissal: useLocalDismissal(`whatsnew-feature_phone_${props.profile.id}`),
    announcementDate: {
      year: 2022,
      month: 10,
      day: 11,
    },
  };

  // Only show its announcement if phone masking is live:
  if (isPhonesAvailableInCountry(props.runtimeData)) {
    entries.push(phoneAnnouncement);
  }

  const vpnAndRelayAnnouncement: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-bundle-header-2", {
      savings: "40%",
    }),
    snippet: l10n.getString("whatsnew-feature-bundle-snippet-2"),
    content:
      props.runtimeData && isBundleAvailableInCountry(props.runtimeData) ? (
        <WhatsNewContent
          description={l10n.getString("whatsnew-feature-bundle-body-v2", {
            monthly_price: getBundlePrice(props.runtimeData, l10n),
            savings: "40%",
          })}
          heading={l10n.getString("whatsnew-feature-bundle-header-2", {
            savings: "40%",
          })}
          image={BundleHero}
          videos={{
            // Unfortunately video files cannot currently be imported, so make
            // sure these files are present in /public. See
            // https://github.com/vercel/next.js/issues/35248
            "video/webm; codecs='vp9'":
              "/animations/whatsnew/bundle-promo-hero.webm",
            "video/mp4": "/animations/whatsnew/bundle-promo-hero.mp4",
          }}
          cta={
            <CtaLinkButton
              // TODO: Add has_bundle to profile data => subscribed={props.profile.has_bundle}
              label={l10n.getString("whatsnew-feature-bundle-upgrade-cta")}
            />
          }
        />
      ) : null,

    icon: BundleIcon,
    dismissal: useLocalDismissal(`whatsnew-feature_phone_${props.profile.id}`),
    announcementDate: {
      year: 2022,
      month: 10,
      day: 11,
    },
  };

  // Only show its announcement if bundle is live:
  if (isBundleAvailableInCountry(props.runtimeData)) {
    entries.push(vpnAndRelayAnnouncement);
  }

  const firefoxIntegrationAnnouncement: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-firefox-integration-heading"),
    snippet: l10n.getString("whatsnew-feature-firefox-integration-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-firefox-integration-description"
        )}
        heading={l10n.getString("whatsnew-feature-firefox-integration-heading")}
        image={FirefoxIntegrationHero}
      />
    ),
    icon: FirefoxIntegrationIcon,
    dismissal: useLocalDismissal(
      `whatsnew-feature_firefox-integration_${props.profile.id}`
    ),
    // Week after release of Firefox 111 (to ensure it was rolled out to everyone)
    announcementDate: {
      year: 2023,
      month: 3,
      day: 21,
    },
  };
  if (
    isFlagActive(props.runtimeData, "firefox_integration") &&
    isUsingFirefox()
  ) {
    entries.push(firefoxIntegrationAnnouncement);
  }

  const entriesNotInFuture = entries.filter((entry) => {
    const entryDate = new Date(
      Date.UTC(
        entry.announcementDate.year,
        entry.announcementDate.month - 1,
        entry.announcementDate.day
      )
    );
    // Filter out entries that are in the future:
    return entryDate.getTime() <= Date.now();
  });
  entriesNotInFuture.sort(entriesDescByDateSorter);

  const newEntries = entriesNotInFuture.filter((entry) => {
    const entryDate = new Date(
      Date.UTC(
        entry.announcementDate.year,
        entry.announcementDate.month - 1,
        entry.announcementDate.day
      )
    );
    const ageInMilliSeconds = Date.now() - entryDate.getTime();
    // Automatically move entries to the archive after 30 days:
    const isExpired = ageInMilliSeconds > 30 * 24 * 60 * 60 * 1000;
    return !entry.dismissal.isDismissed && !isExpired;
  });

  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    triggerState,
    triggerRef
  );

  const positionProps = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef: overlayRef,
    placement: "bottom end",
    offset: 10,
    isOpen: triggerState.isOpen,
  }).overlayProps;

  const { buttonProps } = useButton(triggerProps, triggerRef);

  if (entriesNotInFuture.length === 0) {
    return null;
  }

  const pill =
    newEntries.length > 0 ? (
      <i
        aria-label={l10n.getString("whatsnew-counter-label", {
          count: newEntries.length,
        })}
        className={styles.pill}
      >
        {newEntries.length}
      </i>
    ) : null;

  return (
    <>
      <button
        {...buttonProps}
        ref={triggerRef}
        className={`${styles.trigger} ${
          triggerState.isOpen ? styles["is-open"] : ""
        } ${props.style}`}
      >
        <GiftIcon
          className={styles["trigger-icon"]}
          alt={l10n.getString("whatsnew-trigger-label")}
        />
        <span className={styles["trigger-label"]}>
          {l10n.getString("whatsnew-trigger-label")}
        </span>
        {pill}
      </button>
      {
        <OverlayContainer>
          <WhatsNewPopover
            {...overlayProps}
            {...positionProps}
            ref={overlayRef}
            title={l10n.getString("whatsnew-trigger-label")}
            isOpen={triggerState.isOpen}
            onClose={() => triggerState.close()}
          >
            <WhatsNewDashboard
              new={newEntries}
              archive={entriesNotInFuture}
              onClose={() => triggerState.close()}
            />
          </WhatsNewPopover>
        </OverlayContainer>
      }
    </>
  );
};

type PopoverProps = {
  title: string;
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
} & HTMLAttributes<HTMLDivElement>;
const WhatsNewPopover = forwardRef<HTMLDivElement, PopoverProps>(
  ({ title, children, isOpen, onClose, ...otherProps }, ref) => {
    const { overlayProps } = useOverlay(
      {
        onClose: onClose,
        isOpen: isOpen,
        isDismissable: true,
      },
      ref as RefObject<HTMLDivElement>
    );

    const { modalProps } = useModal();

    const { dialogProps, titleProps } = useDialog(
      {},
      ref as RefObject<HTMLDivElement>
    );

    const mergedOverlayProps = mergeProps(
      overlayProps,
      dialogProps,
      otherProps,
      modalProps
    );

    return (
      <FocusScope restoreFocus contain autoFocus>
        <div
          {...mergedOverlayProps}
          ref={ref}
          className={styles["popover-wrapper"]}
          style={{
            ...mergedOverlayProps.style,
            display: !isOpen ? "none" : mergedOverlayProps.style?.display,
          }}
        >
          <VisuallyHidden>
            <h2 {...titleProps}>{title}</h2>
          </VisuallyHidden>
          {children}
          <DismissButton onDismiss={onClose} />
        </div>
      </FocusScope>
    );
  }
);
WhatsNewPopover.displayName = "WhatsNewPopover";

const entriesDescByDateSorter: Parameters<Array<WhatsNewEntry>["sort"]>[0] = (
  entryA,
  entryB
) => {
  const dateANr =
    entryA.announcementDate.year +
    entryA.announcementDate.month / 100 +
    entryA.announcementDate.day / 10000;
  const dateBNr =
    entryB.announcementDate.year +
    entryB.announcementDate.month / 100 +
    entryB.announcementDate.day / 10000;

  return dateBNr - dateANr;
};
