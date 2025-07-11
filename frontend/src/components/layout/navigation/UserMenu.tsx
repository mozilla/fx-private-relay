import {
  useMenuTriggerState,
  useTreeState,
  TreeProps,
  TreeState,
  Item,
} from "react-stately";
import {
  useMenuTrigger,
  useButton,
  useOverlay,
  FocusScope,
  DismissButton,
  mergeProps,
  useMenuItem,
  useFocus,
} from "react-aria";
import { Key, ReactNode, useRef, useState } from "react";
import { AriaMenuItemProps } from "@react-aria/menu";
import Link from "next/link";
import styles from "./UserMenu.module.scss";
import {
  Cogwheel,
  ContactIcon,
  NewTabIcon,
  SignOutIcon,
  SupportIcon,
} from "../../Icons";
import { useUsers } from "../../../hooks/api/user";
import { useProfiles } from "../../../hooks/api/profile";
import { getRuntimeConfig } from "../../../config";
import { getCsrfToken } from "../../../functions/cookies";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { setCookie } from "../../../functions/cookies";
import { useGaEvent } from "../../../hooks/gaEvent";
import { useL10n } from "../../../hooks/l10n";
import { MenuPopupProps, useMenu } from "../../../hooks/menu";
import React from "react";

export type Props = {
  style: string;
};
/**
 * Display the user's avatar, which can open a menu allowing the user to log out or go to their settings page.
 */
export const UserMenu = (props: Props) => {
  const runtimeData = useRuntimeData();
  const profileData = useProfiles();
  const usersData = useUsers();
  const l10n = useL10n();
  const gaEvent = useGaEvent();

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
  const logoutFormRef = useRef<HTMLFormElement>(null);

  if (
    !Array.isArray(usersData.data) ||
    usersData.data.length !== 1 ||
    !runtimeData.data
  ) {
    // Still fetching the user's account data...
    return null;
  }

  const onSelect = (itemKey: Key) => {
    if (itemKey === itemKeys.signout) {
      return;
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
          href={`${runtimeData.data.FXA_ORIGIN}/support/?utm_source=${
            getRuntimeConfig().frontendOrigin
          }`}
          title={l10n.getString("nav-profile-contact-tooltip")}
          className={styles["menu-link"]}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ContactIcon width={20} height={20} alt="" />
          {l10n.getString("nav-profile-contact")}
        </a>
      </Item>
    ) : null;

  return (
    <UserMenuTrigger
      style={props.style}
      label={
        <img
          src={profileData.data?.[0].avatar}
          alt={l10n.getString("label-open-menu")}
          width={42}
          height={42}
        />
      }
      onAction={onSelect}
    >
      <Item
        key={itemKeys.account}
        textValue={l10n.getString("nav-profile-manage-account")}
      >
        <span className={styles["account-menu-item"]}>
          <b className={styles["user-email"]}>{usersData.data[0].email}</b>
          <a
            href={`${runtimeData.data.FXA_ORIGIN}/settings/`}
            ref={accountLinkRef}
            target="_blank"
            rel="noopener noreferrer"
            className={styles["settings-link"]}
          >
            {l10n.getString("nav-profile-manage-account")}
            <NewTabIcon alt="" />
          </a>
        </span>
      </Item>
      <Item
        key={itemKeys.settings}
        textValue={l10n.getString("nav-profile-settings")}
      >
        <Link
          href="/accounts/settings"
          ref={settingsLinkRef}
          title={l10n.getString("nav-profile-settings-tooltip")}
          className={styles["menu-link"]}
        >
          <Cogwheel width={20} height={20} alt="" />
          {l10n.getString("nav-profile-settings")}
        </Link>
      </Item>
      {contactLink as React.JSX.Element}
      <Item key={itemKeys.help} textValue={l10n.getString("nav-profile-help")}>
        <a
          ref={helpLinkRef}
          href={`${getRuntimeConfig().supportUrl}?utm_source=${
            getRuntimeConfig().frontendOrigin
          }`}
          title={l10n.getString("nav-profile-help-tooltip")}
          className={styles["menu-link"]}
          target="_blank"
          rel="noopener noreferrer"
        >
          <SupportIcon width={20} height={20} alt="" />
          {l10n.getString("nav-profile-help")}
        </a>
      </Item>
      <Item key={itemKeys.signout}>
        <form
          method="POST"
          action={getRuntimeConfig().fxaLogoutUrl}
          ref={logoutFormRef}
        >
          <input
            type="hidden"
            name="csrfmiddlewaretoken"
            value={getCsrfToken()}
          />
          <button
            type="button"
            className={styles["menu-button"]}
            onClick={() => {
              gaEvent({
                category: "Sign Out",
                action: "Click",
                label: "Website Sign Out",
              });
              setCookie("user-sign-out", "true", { maxAgeInSeconds: 60 * 60 });
              logoutFormRef.current?.submit();
            }}
          >
            <SignOutIcon alt="" />
            {l10n.getString("nav-profile-sign-out")}
          </button>
        </form>
      </Item>
    </UserMenuTrigger>
  );
};

type UserMenuTriggerProps = Parameters<typeof useMenuTriggerState>[0] & {
  label: ReactNode;
  style: string;
  children: TreeProps<Record<string, never>>["children"];
  onAction: AriaMenuItemProps["onAction"];
};
const UserMenuTrigger = ({
  label,
  style,
  ...otherProps
}: UserMenuTriggerProps) => {
  const l10n = useL10n();
  const userMenuTriggerState = useMenuTriggerState(otherProps);

  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger(
    {},
    userMenuTriggerState,
    triggerButtonRef,
  );
  // `menuProps` has an `autoFocus` property that is not compatible with the
  // `autoFocus` property for HTMLElements, because it can also be of type
  // `FocusStrategy` (i.e. the string "first" or "last") at the time of writing.
  // Since its values get spread onto an HTMLUListElement, we ignore those
  // values. See
  // https://github.com/mozilla/fx-private-relay/pull/3261#issuecomment-1493840024
  const menuPropsWithoutAutofocus = {
    ...menuProps,
    autoFocus:
      typeof menuProps.autoFocus === "boolean"
        ? menuProps.autoFocus
        : undefined,
  };

  const triggerButtonProps = useButton(
    menuTriggerProps,
    triggerButtonRef,
  ).buttonProps;

  return (
    <div className={`${styles.wrapper} ${style}`}>
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
          domProps={menuPropsWithoutAutofocus}
          autoFocus={userMenuTriggerState.focusStrategy}
          onClose={() => userMenuTriggerState.close()}
        />
      )}
    </div>
  );
};

type UserMenuPopupProps = MenuPopupProps<Record<string, never>>;
const UserMenuPopup = (props: UserMenuPopupProps) => {
  const popupState = useTreeState({ ...props, selectionMode: "none" });

  const popupRef = useRef<HTMLUListElement>(null);
  const popupProps = useMenu(props, popupState, popupRef).menuProps;

  const overlayRef = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    {
      onClose: props.onClose,
      shouldCloseOnBlur: true,
      isOpen: true,
      isDismissable: true,
    },
    overlayRef,
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
              item={item as unknown as UserMenuItemProps["item"]}
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
  const menuItemProps = useMenuItem(
    {
      key: props.item.key,
      isDisabled: props.item.isDisabled,
      onAction: props.onAction,
      onClose: props.onClose,
    },
    props.state,
    menuItemRef,
  ).menuItemProps;

  const [_isFocused, setIsFocused] = useState(false);
  const focusProps = useFocus({ onFocusChange: setIsFocused }).focusProps;

  return (
    <li
      {...mergeProps(menuItemProps, focusProps)}
      ref={menuItemRef}
      className={styles["menu-item-wrapper"]}
    >
      {props.item.rendered}
    </li>
  );
};
