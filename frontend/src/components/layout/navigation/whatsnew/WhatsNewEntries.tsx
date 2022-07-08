import { useLocalization } from "@fluent/react";
import { ReactFragment, ReactNode } from "react";
import { getLocale } from "../../../../functions/getLocale";
// import { isUsingFirefox } from "../../../../functions/userAgent";
import { isFlagActive } from "../../../../functions/waffle";
import { ProfileData, useProfiles } from "../../../../hooks/api/profile";
import { RuntimeData } from "../../../../hooks/api/runtimeData";
import {
  DismissalData,
  useLocalDismissal,
} from "../../../../hooks/localDismissal";
import { WhatsNewContent } from "./WhatsNewContent";
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
import { WhatsNewDashboard } from "./WhatsNewDashboard";
import styles from "./WhatsNewMenu.module.scss";
import { useAddonData } from "../../../../hooks/addon";
import { isUsingFirefox } from "../../../../functions/userAgent";
import { useOverlayTriggerState } from "react-stately";
import { event as gaEvent } from "react-ga";

export type WhatsNewEntry = {
  title: string;
  snippet: string;
  content: ReactNode;
  hero: string;
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
  style?: string;
  runtimeData?: RuntimeData;
  onClose?: () => void;
};

export const WhatsNewEntries = (props: Props) => {
  const { l10n } = useLocalization();
  // const triggerState = useOverlayTriggerState({
  //   onOpenChange(isOpen) {
  //     gaEvent({
  //       category: "News",
  //       action: isOpen ? "Open" : "Close",
  //       label: "header-nav",
  //     });
  //   },
  // });
  const profile = useProfiles();
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
      hero: SizeLimitHero.src,
      icon: SizeLimitIcon.src,
      dismissal: useLocalDismissal(`whatsnew-feature_size-limit_${profile}`),
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
    hero: ForwardSomeHero.src,
    icon: ForwardSomeIcon.src,
    dismissal: useLocalDismissal(
      `whatsnew-feature_sign-back-in_${profile.data?.[0].id}`
    ),
    announcementDate: {
      year: 2022,
      month: 3,
      day: 1,
    },
  };
  if (profile.data?.[0].has_premium) {
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
    hero: SignBackInHero.src,
    icon: SignBackInIcon.src,
    dismissal: useLocalDismissal(
      `whatsnew-feature_sign-back-in_${profile.data?.[0].id}`
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
  entries.push(signBackInEntry);

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
    hero: aliasToMaskHero.src,
    icon: aliasToMaskIcon.src,
    dismissal: useLocalDismissal(
      `whatsnew-feature_alias-to-mask_${profile.data?.[0].id}`
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
    hero: PremiumSwedenHero.src,
    icon: PremiumSwedenIcon.src,
    dismissal: useLocalDismissal(
      `whatsnew-feature_premium-expansion-sweden_${profile.data?.[0].id}`
    ),
    announcementDate: {
      year: 2022,
      month: 5,
      day: 17,
    },
  };
  if (
    props.runtimeData?.PREMIUM_PLANS.country_code.toLowerCase() === "se" &&
    !profile.data?.[0].has_premium
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
    hero: PremiumFinlandHero.src,
    icon: PremiumFinlandIcon.src,
    dismissal: useLocalDismissal(
      `whatsnew-feature_premium-expansion-finland_${profile.data?.[0].id}`
    ),
    announcementDate: {
      year: 2022,
      month: 5,
      day: 17,
    },
  };
  if (
    props.runtimeData?.PREMIUM_PLANS.country_code.toLowerCase() === "fi" &&
    !profile.data?.[0].has_premium
  ) {
    entries.push(premiumInFinland);
  }

  const trackerRemoval: WhatsNewEntry = {
    title: l10n.getString("whatsnew-feature-tracker-removal-heading"),
    snippet: l10n.getString("whatsnew-feature-tracker-removal-snippet"),
    content: (
      <WhatsNewContent
        description={l10n.getString(
          "whatsnew-feature-tracker-removal-description"
        )}
        heading={l10n.getString("whatsnew-feature-tracker-removal-heading")}
        image={TrackerRemovalHero.src}
      />
    ),
    hero: TrackerRemovalHero.src,
    icon: TrackerRemovalIcon.src,
    dismissal: useLocalDismissal(
      `whatsnew-feature_tracker-removal_${profile.data?.[0].id}`
    ),
    announcementDate: {
      year: 2022,
      month: 6,
      day: 23,
    },
  };
  // Only show its announcement if tracker removal is live:
  if (isFlagActive(props.runtimeData, "tracker_removal")) {
    entries.push(trackerRemoval);
  }

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

  getPillNum(pill);

  return (
    <>
      {props.onClose && (
        <WhatsNewDashboard
          new={newEntries}
          archive={entries}
          onClose={props.onClose}
        />
      )}
    </>
  );
};

export const getPillNum = (pillnumval: JSX.Element | null) => {
  return { pillnumval };
};
