import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useRef,
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
import styles from "./WhatsNewMenu.module.scss";
import SizeLimitHero from "./images/size-limit-hero-10mb.svg";
import SizeLimitIcon from "./images/size-limit-icon-10mb.svg";
import SignBackInHero from "./images/sign-back-in-hero.svg";
import SignBackInIcon from "./images/sign-back-in-icon.svg";
import ForwardSomeHero from "./images/forward-some-hero.svg";
import ForwardSomeIcon from "./images/forward-some-icon.svg";
import { WhatsNewContent } from "./WhatsNewContent";
import {
  DismissalData,
  useLocalDismissal,
} from "../../../hooks/localDismissal";
import { ProfileData } from "../../../hooks/api/profile";
import { WhatsNewDashboard } from "./WhatsNewDashboard";
import { useAddonData } from "../../../hooks/addon";
import { isUsingFirefox } from "../../../functions/userAgent";

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
  profile: ProfileData;
};
export const WhatsNewMenu = (props: Props) => {
  const { l10n } = useLocalization();
  const triggerState = useOverlayTriggerState({});
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
      hero: SizeLimitHero.src,
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
    hero: ForwardSomeHero.src,
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
        image={SizeLimitHero.src}
      />
    ),
    hero: SignBackInHero.src,
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
    placement: "bottom",
    offset: 10,
    isOpen: triggerState.isOpen,
  }).overlayProps;

  const { buttonProps } = useButton(
    { onPress: () => triggerState.open() },
    triggerRef
  );

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
        {...triggerProps}
        ref={triggerRef}
        className={`${styles.trigger} ${
          triggerState.isOpen ? styles["is-open"] : ""
        }`}
      >
        {l10n.getString("whatsnew-trigger-label")}
        {pill}
      </button>
      {triggerState.isOpen && (
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
      )}
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

    return (
      <FocusScope restoreFocus contain autoFocus>
        <div
          {...mergeProps(overlayProps, dialogProps, otherProps, modalProps)}
          ref={ref}
          className={styles["popover-wrapper"]}
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
