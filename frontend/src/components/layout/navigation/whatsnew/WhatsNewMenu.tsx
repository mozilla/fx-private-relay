import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useRef,
  useState,
} from "react";
import { useLocalization } from "@fluent/react";
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
  VisuallyHidden,
} from "react-aria";
import { useOverlayTriggerState } from "react-stately";
import { event as gaEvent } from "react-ga";
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
  isPhonesAvailableInCountry,
  isPremiumAvailableInCountry,
} from "../../../../functions/getPlan";
import { parseDate } from "../../../../functions/parseDate";
import { CountdownTimer } from "../../../CountdownTimer";
import { useInterval } from "../../../../hooks/interval";
import Link from "next/link";

export type WhatsNewEntry = {
  title: string;
  snippet: string;
  content: ReactNode;
  icon: string;
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
        <Link href="/premium#pricing">
          <span className={styles.cta}>{props.label}</span>
        </Link>
      ) : null}
    </>
  );
};

export const WhatsNewMenu = (props: Props) => {
  const { l10n } = useLocalization();

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
          image={SizeLimitHero.src}
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
      icon: SizeLimitIcon.src,
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
        image={ForwardSomeHero.src}
      />
    ),
    icon: ForwardSomeIcon.src,
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
        image={SignBackInHero.src}
      />
    ),
    icon: SignBackInIcon.src,
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
        image={aliasToMaskHero.src}
      />
    ),
    icon: aliasToMaskIcon.src,
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
        image={PremiumSwedenHero.src}
      />
    ),
    icon: PremiumSwedenIcon.src,
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
    props.runtimeData?.PREMIUM_PLANS.country_code.toLowerCase() === "se" &&
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
        image={PremiumFinlandHero.src}
      />
    ),
    icon: PremiumFinlandIcon.src,
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
    props.runtimeData?.PREMIUM_PLANS.country_code.toLowerCase() === "fi" &&
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
        image={TrackerRemovalHero.src}
      />
    ),
    icon: TrackerRemovalIcon.src,
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
  const introPricingOfferEndDate = props.runtimeData
    ? parseDate(props.runtimeData.INTRO_PRICING_END)
    : new Date(0);
  const [now, setNow] = useState(Date.now());
  const remainingTimeInMs = introPricingOfferEndDate.getTime() - now;
  // Show the countdown timer to the end of our introductory pricing offer if…
  useInterval(
    () => {
      setNow(Date.now());
    },
    // Only count down if the deadline is close and not in the past:
    remainingTimeInMs > 0 && remainingTimeInMs <= 32 * 24 * 60 * 60 * 1000
      ? 1000
      : null
  );

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
            <CountdownTimer
              remainingTimeInMs={Math.max(remainingTimeInMs, 0)}
            />
          </div>
        }
      />
    ),
    icon: OfferCountdownIcon.src,
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
  // tab if the countdown has finished:
  introPricingCountdown.dismissal.isDismissed ||= remainingTimeInMs <= 0;
  if (
    // If the remaining time isn't far enough in the future that the user's
    // computer's clock is likely to be wrong,
    remainingTimeInMs <= 32 * 24 * 60 * 60 * 1000 &&
    // …the user does not have Premium yet,
    !props.profile.has_premium &&
    // …the user is able to purchase Premium at the introductory offer price, and
    isPremiumAvailableInCountry(props.runtimeData) &&
    // …the relevant feature flag is enabled:
    isFlagActive(props.runtimeData, "intro_pricing_countdown")
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
          image={PhoneMaskingHero.src}
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

    icon: PhoneMaskingIcon.src,
    dismissal: useLocalDismissal(`whatsnew-feature_phone_${props.profile.id}`),
    announcementDate: {
      year: 2022,
      month: 10,
      day: 11,
    },
  };

  // Only show its announcement if phone masking is live:
  if (
    isPhonesAvailableInCountry(props.runtimeData) &&
    isFlagActive(props.runtimeData, "phones")
  ) {
    entries.push(phoneAnnouncement);
  }

  const vpnAndRelayAnnouncement: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-bundle-header"),
    snippet: l10n.getString("whatsnew-feature-bundle-snippet"),
    content:
      props.runtimeData && isBundleAvailableInCountry(props.runtimeData) ? (
        <WhatsNewContent
          description={l10n.getString("whatsnew-feature-bundle-body", {
            monthly_price: getBundlePrice(props.runtimeData, l10n),
            savings: "??%", // Design states 50%
          })}
          heading={l10n.getString("whatsnew-feature-bundle-header")}
          image={BundleHero.src}
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

    icon: BundleIcon.src,
    dismissal: useLocalDismissal(`whatsnew-feature_phone_${props.profile.id}`),
    announcementDate: {
      year: 2022,
      month: 10,
      day: 11,
    },
  };

  // Only show its announcement if bundle is live:
  if (
    isFlagActive(props.runtimeData, "bundle") &&
    isBundleAvailableInCountry(props.runtimeData)
  ) {
    entries.push(vpnAndRelayAnnouncement);
  }

  entries.sort(entriesDescByDateSorter);

  const newEntries = entries.filter((entry) => {
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

  if (entries.length === 0) {
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
        {l10n.getString("whatsnew-trigger-label")}
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
              archive={entries}
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
