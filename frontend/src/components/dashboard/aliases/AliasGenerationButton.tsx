import { useLocalization } from "@fluent/react";
import {
  FocusScope,
  useOverlay,
  useMenuTrigger,
  useMenu,
  DismissButton,
  mergeProps,
  useMenuItem,
  useFocus,
  useButton,
} from "react-aria";
import { OverlayProps } from "@react-aria/overlays";
import { AriaMenuItemProps } from "@react-aria/menu";
import { Item, MenuTriggerState, TreeProps, TreeState, useMenuTriggerState, useOverlayTriggerState, useTreeState } from "react-stately";
import {
  HTMLAttributes,
  Key,
  ReactNode,
  useRef,
  useState,
} from "react";
import styles from "./AliasGenerationButton.module.scss";
import plusIcon from "../../../../../static/images/plus-sign-white.svg";
import arrowHeadIcon from "../../../../../static/images/arrowhead-white.svg";
import { ProfileData } from "../../../hooks/api/profile";
import { Button, LinkButton } from "../../Button";
import {
  AliasData,
} from "../../../hooks/api/aliases";
import { getRuntimeConfig } from "../../../config";
import { PremiumCountriesData } from "../../../hooks/api/premiumCountries";
import { getPremiumSubscribeLink, isPremiumAvailableInCountry } from "../../../functions/getPlan";
import { useGaPing } from "../../../hooks/gaPing";
import { trackPurchaseStart } from "../../../functions/trackPurchase";
import { AddressPickerModal } from "./AddressPickerModal";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  premiumCountries?: PremiumCountriesData;
  onCreate: (options: { type: "random" } | { type: "custom", address: string }) => void;
};

export const AliasGenerationButton = (props: Props) => {
  const { l10n } = useLocalization();
  const getUnlimitedButtonRef = useGaPing({
    category: "Purchase Button",
    label: "profile-create-alias-upgrade-promo",
  });

  const maxAliases = getRuntimeConfig().maxFreeAliases;
  if (!props.profile.has_premium && props.aliases.length >= maxAliases) {
    // If the user does not have Premium, has reached the alias limit,
    // and Premium is not available to them, show a greyed-out button:
    if (!isPremiumAvailableInCountry(props.premiumCountries)) {
      return (
        <Button disabled>
          <img src={plusIcon.src} alt="" width={16} height={16} />
          {l10n.getString("profile-label-generate-new-alias")}
        </Button>
      );
    }

    // If the user does not have Premium, has reached the alias limit,
    // and Premium is available to them, prompt them to upgrade:
    return (
      <LinkButton
        href={getPremiumSubscribeLink(props.premiumCountries)}
        target="_blank"
        rel="noopener noreferrer"
        ref={getUnlimitedButtonRef}
        onClick={() =>
          trackPurchaseStart({ label: "profile-create-alias-upgrade-promo" })
        }
      >
        {l10n.getString("profile-label-upgrade")}
      </LinkButton>
    );
  }

  if (getRuntimeConfig().featureFlags.generateCustomAliasMenu === true && props.profile.has_premium && typeof props.profile.subdomain === "string") {
    return <AliasTypeMenu onCreate={props.onCreate} subdomain={props.profile.subdomain} />;
  }

  return (
    <Button
      onClick={() => props.onCreate({ type: "random" })}
      title={l10n.getString("profile-label-generate-new-alias")}
    >
      <img src={plusIcon.src} alt="" width={16} height={16} />
      {l10n.getString("profile-label-generate-new-alias")}
    </Button>
  );
};

type AliasTypeMenuProps = {
  subdomain: string;
  onCreate: (options: { type: "random" } | { type: "custom", address: string }) => void;
};
const AliasTypeMenu = (props: AliasTypeMenuProps) => {
  const { l10n } = useLocalization();
  const modalState = useOverlayTriggerState({});

  const onAction = (key: Key) => {
    if (key === "random") {
      props.onCreate({ type: "random" });
      return;
    }
    if (key === "custom") {
      modalState.open();
    }
  };

  const onPick = (address: string) => {
    props.onCreate({ type: "custom", address: address });
    modalState.close();
  };

  const dialog = modalState.isOpen
    ? <AddressPickerModal
      isOpen={modalState.isOpen}
      onClose={() => modalState.close()}
      onPick={onPick}
      subdomain={props.subdomain}
    />
    : null;

  return (
    <>
      <AliasTypeMenuButton onAction={onAction}>
        <Item key="random">
          {l10n.getString("profile-label-generate-new-alias-menu-random")}
        </Item>
        <Item key="custom">
          {l10n.getString("profile-label-generate-new-alias-menu-custom", { subdomain: props.subdomain })}
        </Item>
      </AliasTypeMenuButton>
      {dialog}
    </>
  );
};

type AliasTypeMenuButtonProps = Parameters<typeof useMenuTriggerState>[0] & {
  children: TreeProps<Record<string, never>>["children"];
  onAction: AriaMenuItemProps["onAction"];
};
const AliasTypeMenuButton = (props: AliasTypeMenuButtonProps) => {
  const { l10n } = useLocalization();
  const triggerState = useMenuTriggerState(props);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {menuTriggerProps, menuProps} = useMenuTrigger({}, triggerState, triggerRef);

  const triggerButtonProps = useButton(
    menuTriggerProps,
    triggerRef
  ).buttonProps;

  return (
    <div className={styles.buttonWrapper}>
      <Button ref={triggerRef} {...triggerButtonProps}>
        {l10n.getString("profile-label-generate-new-alias")}
        <img src={arrowHeadIcon.src} alt="" width={16} height={16} />
      </Button>
      {triggerState.isOpen && (
        <AliasTypeMenuPopup
          {...props}
          aria-label={l10n.getString("profile-label-generate-new-alias")}
          domProps={menuProps}
          autoFocus={triggerState.focusStrategy}
          onClose={() => triggerState.close()}
        />
      )}
    </div>
  );
};

type AliasTypeMenuPopupProps = TreeProps<Record<string, never>> & {
  onAction: AriaMenuItemProps["onAction"];
  domProps: HTMLAttributes<HTMLElement>;
  onClose?: OverlayProps["onClose"];
  autoFocus?: MenuTriggerState["focusStrategy"];
};
const AliasTypeMenuPopup = (props: AliasTypeMenuPopupProps) => {
  const popupState = useTreeState({...props, selectionMode: "none"});

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
            <AliasTypeMenuItem
              key={item.key}
              // TODO: Fix the typing (likely: report to react-aria that the type does not include an isDisabled prop)
              item={item as unknown as AliasTypeMenuItemProps["item"]}
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

type AliasTypeMenuItemProps = {
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

const AliasTypeMenuItem = (props: AliasTypeMenuItemProps) => {
  const menuItemRef = useRef<HTMLLIElement>(null);
  const menuItemProps = useMenuItem(
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
  const focusProps = useFocus({ onFocusChange: setIsFocused }).focusProps;

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
