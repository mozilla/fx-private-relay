import {
  useMenuTriggerState,
  useTreeState,
  TreeProps,
  TreeState,
  MenuTriggerState,
  Item,
} from "react-stately";
import {
  useMenuTrigger,
  useButton,
  useMenu,
  useOverlay,
  FocusScope,
  DismissButton,
  mergeProps,
  useMenuItem,
  useFocus,
} from "react-aria";
import { HTMLAttributes, Key, ReactNode, useRef, useState } from "react";
import { AriaMenuItemProps } from "@react-aria/menu";
import { OverlayProps } from "@react-aria/overlays";
import { useLocalization } from "@fluent/react";
import Link from "next/link";
import { event as gaEvent } from "react-ga";
import styles from "./UserMenu.module.scss";
import SettingsImage from "../../../../static/images/settings.svg";
import ContactImage from "../../../../static/images/icon-message.svg";
import HelpImage from "../../../../static/images/help.svg";
import SignoutImage from "../../../../static/images/glocal-sign-out.svg";
import { useUsers } from "../../hooks/api/user";
import { useProfiles } from "../../hooks/api/profile";

export const UserMenu = () => {
  const profileData = useProfiles();
  const usersData = useUsers();
  const { l10n } = useLocalization();

  const itemKeys = {
    account: "account",
    settings: "settings",
    contact: "contact",
    help: "help",
    signout: "signout",
  };
  const accountLinkRef = useRef<HTMLAnchorElement>(null);
  const settingsLinkRef = useRef<HTMLAnchorElement>(null);
  const contactLinkRef = useRef<HTMLAnchorElement>(null);
  const helpLinkRef = useRef<HTMLAnchorElement>(null);

  if (!Array.isArray(usersData.data) || usersData.data.length !== 1) {
    // Still fetching the user's account data...
    return null;
  }

  const onSelect = (itemKey: Key) => {
    if (itemKey === itemKeys.account) {
      accountLinkRef.current?.click();
    }
    if (itemKey === itemKeys.settings) {
      settingsLinkRef.current?.click();
    }
    if (itemKey === itemKeys.contact) {
      contactLinkRef.current?.click();
    }
    if (itemKey === itemKeys.help) {
      helpLinkRef.current?.click();
    }
    if (itemKey === itemKeys.signout) {
      gaEvent({
        category: "Sign Out",
        action: "Click",
        label: "Website Sign Out",
      });
      // TODO: Actually log out
    }
  };

  const contactLink =
    profileData.data?.[0]?.has_premium === true ? (
      <Item
        key={itemKeys.contact}
        textValue={l10n.getString("nav-profile-contact")}
      >
        <a
          ref={contactLinkRef}
          href={`${process.env.NEXT_PUBLIC_FXA_SUPPORT_URL}?utm_source=${process.env.NEXT_PUBLIC_SITE_ORIGIN}`}
          title={l10n.getString("nav-profile-contact-tooltip")}
          className={styles.menuLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MenuItemIcon src={ContactImage.src} />
          {l10n.getString("nav-profile-contact")}
        </a>
      </Item>
    ) : null;

  return (
    <UserMenuTrigger label={<>TODO: Avatar</>} onAction={onSelect}>
      <Item
        key={itemKeys.account}
        textValue={l10n.getString("nav-profile-manage-fxa")}
      >
        <span className={styles.accountMenuItem}>
          <b className={styles.userEmail}>{usersData.data[0].email}</b>
          <a
            href={`${process.env.NEXT_PUBLIC_FXA_BASE_ORIGIN}settings/`}
            ref={accountLinkRef}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.settingsLink}
          >
            {l10n.getString("nav-profile-manage-fxa")}
          </a>
        </span>
      </Item>
      <Item
        key={itemKeys.settings}
        textValue={l10n.getString("nav-profile-settings")}
      >
        <Link href="/accounts/settings">
          <a
            ref={settingsLinkRef}
            title={l10n.getString("nav-profile-settings-tooltip")}
            className={styles.menuLink}
          >
            <MenuItemIcon src={SettingsImage.src} />
            {l10n.getString("nav-profile-settings")}
          </a>
        </Link>
      </Item>
      {contactLink!}
      <Item key={itemKeys.help} textValue={l10n.getString("nav-profile-help")}>
        <a
          ref={helpLinkRef}
          href={`https://support.mozilla.org/products/relay/?utm_source=${process.env.NEXT_PUBLIC_SITE_ORIGIN}`}
          title={l10n.getString("nav-profile-help-tooltip")}
          className={styles.menuLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MenuItemIcon src={HelpImage.src} />
          {l10n.getString("nav-profile-help")}
        </a>
      </Item>
      <Item
        key={itemKeys.signout}
        textValue={l10n.getString("nav-profile-sign-out")}
      >
        <span className={styles.menuButton}>
          <MenuItemIcon src={SignoutImage.src} />
          {l10n.getString("nav-profile-sign-out")}
        </span>
      </Item>
    </UserMenuTrigger>
  );
};

type MenuItemIconProps = {
  src: string;
};
const MenuItemIcon = (props: MenuItemIconProps) => (
  <img src={props.src} alt="" width={28} />
);

type UserMenuTriggerProps = Parameters<typeof useMenuTriggerState>[0] & {
  label: ReactNode;
  children: TreeProps<{}>["children"];
  onAction: AriaMenuItemProps["onAction"];
};
const UserMenuTrigger = ({ label, ...otherProps }: UserMenuTriggerProps) => {
  const { l10n } = useLocalization();
  const userMenuTriggerState = useMenuTriggerState(otherProps);

  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  let { menuTriggerProps, menuProps } = useMenuTrigger(
    {},
    userMenuTriggerState,
    triggerButtonRef
  );

  let triggerButtonProps = useButton(
    menuTriggerProps,
    triggerButtonRef
  ).buttonProps;

  return (
    <div className={styles.wrapper}>
      <button
        {...triggerButtonProps}
        ref={triggerButtonRef}
        title={l10n.getString("avatar-tooltip")}
        className={styles.trigger}
      >
        {label}
      </button>
      {userMenuTriggerState.isOpen && (
        <UserMenuPopup
          {...otherProps}
          aria-label={l10n.getString("avatar-tooltip")}
          domProps={menuProps}
          autoFocus={userMenuTriggerState.focusStrategy}
          onClose={() => userMenuTriggerState.close()}
        />
      )}
    </div>
  );
};

type UserMenuPopupProps = TreeProps<{}> & {
  onAction: AriaMenuItemProps["onAction"];
  domProps: HTMLAttributes<HTMLElement>;
  onClose?: OverlayProps["onClose"];
  autoFocus?: MenuTriggerState["focusStrategy"];
};
const UserMenuPopup = (props: UserMenuPopupProps) => {
  const popupState = useTreeState({ ...props, selectionMode: "none" });

  const popupRef = useRef<HTMLUListElement>(null);
  let popupProps = useMenu(props, popupState, popupRef).menuProps;

  let overlayRef = useRef<HTMLDivElement>(null);
  let { overlayProps } = useOverlay(
    {
      onClose: props.onClose,
      shouldCloseOnBlur: true,
      isOpen: true,
      isDismissable: true,
    },
    overlayRef
  );

  // <FocusScope> ensures that focus is restored back to the
  // trigger when the menu is closed.
  // The <DismissButton> components allow screen reader users
  // to dismiss the popup easily.
  return (
    <FocusScope restoreFocus>
      <div {...overlayProps} ref={overlayRef}>
        <DismissButton onDismiss={props.onClose} />
        <ul
          {...mergeProps(popupProps, props.domProps)}
          ref={popupRef}
          className={styles.popup}
        >
          {Array.from(popupState.collection).map((item) => (
            <UserMenuItem
              key={item.key}
              // TODO: Fix the typing (likely: report to react-aria that the type does not include an isDisabled prop)
              item={item as any}
              state={popupState}
              onAction={props.onAction}
              onClose={props.onClose}
            />
          ))}
        </ul>
        <DismissButton onDismiss={props.onClose} />
      </div>
    </FocusScope>
  );
};

type UserMenuItemProps = {
  // TODO: Figure out correct type:
  item: {
    key: AriaMenuItemProps["key"];
    isDisabled: AriaMenuItemProps["isDisabled"];
    rendered?: ReactNode;
  };
  state: TreeState<unknown>;
  onAction: AriaMenuItemProps["onAction"];
  onClose: AriaMenuItemProps["onClose"];
};

const UserMenuItem = (props: UserMenuItemProps) => {
  const menuItemRef = useRef<HTMLLIElement>(null);
  let menuItemProps = useMenuItem(
    {
      key: props.item.key,
      isDisabled: props.item.isDisabled,
      onAction: props.onAction,
      onClose: props.onClose,
    },
    props.state,
    menuItemRef
  ).menuItemProps;

  const [_isFocused, setIsFocused] = useState(false);
  let focusProps = useFocus({ onFocusChange: setIsFocused }).focusProps;

  return (
    <li
      {...mergeProps(menuItemProps, focusProps)}
      ref={menuItemRef}
      className={styles.menuItemWrapper}
    >
      {props.item.rendered}
    </li>
  );
};
