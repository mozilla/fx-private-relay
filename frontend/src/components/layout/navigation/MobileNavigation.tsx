import Link from "next/link";
import { useLocalization } from "@fluent/react";
import styles from "./MobileNavigation.module.scss";
import { SignUpButton } from "./SignUpButton";
import {
  Cogwheel,
  ContactIcon,
  DashboardIcon,
  FaqIcon,
  NewsIcon,
  HomeIcon,
  NewTabIcon,
  SignOutIcon,
  SupportIcon,
} from "../../Icons";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { getRuntimeConfig } from "../../../config";
import { getCsrfToken } from "../../../functions/cookies";
import { ProfileData } from "../../../hooks/api/profile";
import { WhatsNewEntries } from "./whatsnew/WhatsNewEntries";
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
  useDialog,
  useModal,
  useOverlay,
  useOverlayPosition,
  useOverlayTrigger,
  VisuallyHidden,
} from "react-aria";
import { useOverlayTriggerState } from "react-stately";
import { event as gaEvent } from "react-ga";

export type MenuItem = {
  url: string;
  isVisible?: boolean;
  icon: JSX.Element;
  l10n: string;
};

export type Props = {
  mobileMenuExpanded: boolean | undefined;
  hasPremium: boolean;
  profile: ProfileData | undefined;
  isLoggedIn: boolean;
  userEmail: string | undefined;
  userAvatar: string | undefined;
};

export const MobileNavigation = (props: Props) => {
  const {
    mobileMenuExpanded,
    hasPremium,
    profile,
    isLoggedIn,
    userEmail,
    userAvatar,
  } = props;

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

  const { overlayProps } = useOverlayTrigger(
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

  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();
  const { supportUrl } = getRuntimeConfig();

  const renderMenuItem = (item: MenuItem) => {
    const { isVisible = true } = item;

    return isVisible ? (
      <li className={`${styles["menu-item"]}`}>
        <Link href={item.url}>
          <a className={`${styles.link}`}>
            {item.icon}
            {l10n.getString(item.l10n)}
          </a>
        </Link>
      </li>
    ) : null;
  };

  // We make sure toggle state is not undefined
  // or we get a flash of the mobile menu on page load.
  const toggleMenuStateClass =
    typeof mobileMenuExpanded !== "boolean"
      ? ""
      : mobileMenuExpanded
      ? styles["is-active"]
      : styles["not-active"];

  return (
    <nav
      aria-label={l10n.getString("nav-menu-mobile")}
      className={`${styles["mobile-menu"]}`}
    >
      {/* Below we have conditional rendering of menu items  */}
      <ul
        id={`${styles["mobile-menu"]}`}
        className={`${styles["menu-item-list"]} ${toggleMenuStateClass}`}
      >
        {isLoggedIn && (
          <li className={`${styles["menu-item"]} ${styles["user-info"]}`}>
            <img
              src={userAvatar ?? ""}
              alt=""
              className={styles["user-avatar"]}
              width={42}
              height={42}
            />
            <span>
              <b className={styles["user-email"]}>{userEmail ?? ""}</b>
              <a
                href={`${runtimeData?.data?.FXA_ORIGIN}/settings/`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles["settings-link"]}
              >
                {l10n.getString("nav-profile-manage-fxa")}
                <NewTabIcon width={12} height={18} viewBox="0 0 16 18" alt="" />
              </a>
            </span>
          </li>
        )}

        {renderMenuItem({
          url: "/",
          isVisible: !isLoggedIn,
          icon: <HomeIcon width={20} height={20} alt="" />,
          l10n: "nav-home",
        })}

        {renderMenuItem({
          url: "/accounts/profile",
          isVisible: isLoggedIn,
          icon: <DashboardIcon width={20} height={20} alt="" />,
          l10n: "nav-dashboard",
        })}

        {/* omitting condition as this should always be visible */}
        {renderMenuItem({
          url: "/faq",
          icon: <FaqIcon width={20} height={20} alt="" />,
          l10n: "nav-faq",
        })}

        {renderMenuItem({
          url: "#",
          icon: <NewsIcon width={20} height={20} alt="" />,
          l10n: "whatsnew-trigger-label",
        })}

        <li>
          <OverlayContainer>
            <WhatsNewPopover
              {...overlayProps}
              {...positionProps}
              ref={overlayRef}
              title={l10n.getString("whatsnew-trigger-label")}
              isOpen={triggerState.isOpen}
              onClose={() => triggerState.close()}
            >
              <WhatsNewEntries onClose={() => triggerState.close()} />
            </WhatsNewPopover>
          </OverlayContainer>
          `
        </li>

        {!isLoggedIn && (
          <li
            className={`${styles["menu-item"]} ${styles["sign-up-menu-item"]}`}
          >
            <SignUpButton className={`${styles["sign-up-button"]}`} />
          </li>
        )}

        {renderMenuItem({
          url: "/accounts/settings",
          isVisible: isLoggedIn,
          icon: <Cogwheel width={20} height={20} alt="" />,
          l10n: "nav-settings",
        })}

        {renderMenuItem({
          url: `${runtimeData?.data?.FXA_ORIGIN}/support/?utm_source=${
            getRuntimeConfig().frontendOrigin
          }`,
          isVisible: isLoggedIn && hasPremium,
          icon: <ContactIcon width={20} height={20} alt="" />,
          l10n: "nav-contact",
        })}

        {renderMenuItem({
          url: `${supportUrl}?utm_source=${getRuntimeConfig().frontendOrigin}`,
          isVisible: isLoggedIn,
          icon: <SupportIcon width={20} height={20} alt="" />,
          l10n: "nav-support",
        })}

        {isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <form method="POST" action={getRuntimeConfig().fxaLogoutUrl}>
              <input
                type="hidden"
                name="csrfmiddlewaretoken"
                value={getCsrfToken()}
              />
              <button className={`${styles.link}`} type="submit">
                <SignOutIcon width={20} height={20} alt="" />
                {l10n.getString("nav-sign-out")}
              </button>
            </form>
          </li>
        )}
      </ul>
    </nav>
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
