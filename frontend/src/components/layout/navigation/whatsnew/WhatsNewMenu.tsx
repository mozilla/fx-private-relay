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
import { WhatsNewContent } from "./WhatsNewContent";
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
import { WhatsNewEntries } from "./WhatsNewEntries";

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
  profile: ProfileData | undefined;
  style?: string;
  runtimeData?: RuntimeData;
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

  const { buttonProps } = useButton(
    { onPress: () => triggerState.open() },
    triggerRef
  );

  return (
    <>
      <button
        {...buttonProps}
        {...triggerProps}
        ref={triggerRef}
        className={`${styles.trigger} ${
          triggerState.isOpen ? styles["is-open"] : ""
        } ${props.style}`}
      >
        {l10n.getString("whatsnew-trigger-label")}
        {/* {pill} */}
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
            {/* <WhatsNewDashboard
              new={newEntries}
              archive={entries}
              onClose={() => triggerState.close()}
            /> */}
            <WhatsNewEntries />
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
