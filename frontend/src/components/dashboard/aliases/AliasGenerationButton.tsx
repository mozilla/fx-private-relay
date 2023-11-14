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
  AriaOverlayProps,
} from "react-aria";
import { AriaMenuItemProps } from "@react-aria/menu";
import { event as gaEvent } from "react-ga";
import {
  Item,
  MenuTriggerState,
  TreeProps,
  TreeState,
  useMenuTriggerState,
  useOverlayTriggerState,
  useTreeState,
} from "react-stately";
import {
  HTMLAttributes,
  Key,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./AliasGenerationButton.module.scss";
import { ArrowDownIcon, PlusIcon } from "../../Icons";
import { ProfileData } from "../../../hooks/api/profile";
import { Button, LinkButton } from "../../Button";
import { AliasData } from "../../../hooks/api/aliases";
import { getRuntimeConfig } from "../../../config";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { isPeriodicalPremiumAvailableInCountry } from "../../../functions/getPlan";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import { CustomAddressGenerationModal } from "./CustomAddressGenerationModal";
import { useL10n } from "../../../hooks/l10n";
import { isFlagActive } from "../../../functions/waffle";
import { AddressPickerModal } from "./AddressPickerModal";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  runtimeData?: RuntimeData;
  onCreate: (
    options:
      | { mask_type: "random" }
      | { mask_type: "custom"; address: string; blockPromotionals: boolean },
    setAliasGeneratedState?: (flag: boolean) => void,
  ) => void;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
  findAliasDataFromPrefix: (aliasPrefix: string) => AliasData | undefined;
  setGeneratedAlias: (alias: AliasData | undefined) => void;
};

/**
 * A button to initiate the different flows for creating an alias.
 *
 * Usually, this will be a simple button to generate a new random alias,
 * but it adapts to the situation to e.g. prompt the user to upgrade to Premium
 * when they run out of aliases, or to allow generating a custom alias if the
 * user is able to.
 */
export const AliasGenerationButton = (props: Props) => {
  const l10n = useL10n();
  const getUnlimitedButtonRef = useGaViewPing({
    category: "Purchase Button",
    label: "profile-create-alias-upgrade-promo",
  });

  const maxAliases = getRuntimeConfig().maxFreeAliases;
  if (!props.profile.has_premium && props.aliases.length >= maxAliases) {
    // If the user does not have Premium, has reached the alias limit,
    // and Premium is not available to them, show a greyed-out button:
    if (!isPeriodicalPremiumAvailableInCountry(props.runtimeData)) {
      return (
        <Button disabled>
          <PlusIcon alt="" width={16} height={16} />
          {l10n.getString("profile-label-generate-new-alias-2")}
        </Button>
      );
    }

    // If the user does not have Premium, has reached the alias limit,
    // and Premium is available to them, prompt them to upgrade:
    return (
      <LinkButton
        href="/premium#pricing"
        ref={getUnlimitedButtonRef}
        onClick={() => {
          gaEvent({
            category: "Purchase Button",
            action: "Engage",
            label: "profile-create-alias-upgrade-promo",
          });
        }}
      >
        {l10n.getString("profile-label-upgrade-2")}
      </LinkButton>
    );
  }

  if (
    props.profile.has_premium &&
    typeof props.profile.subdomain === "string"
  ) {
    return (
      <AliasTypeMenu
        onCreate={props.onCreate}
        onUpdate={props.onUpdate}
        subdomain={props.profile.subdomain}
        findAliasDataFromPrefix={props.findAliasDataFromPrefix}
        setGeneratedAlias={props.setGeneratedAlias}
        runtimeData={props.runtimeData}
      />
    );
  }

  return (
    <Button
      onClick={() => props.onCreate({ mask_type: "random" })}
      title={l10n.getString("profile-label-generate-new-alias-2")}
    >
      <PlusIcon alt="" width={16} height={16} />
      {l10n.getString("profile-label-generate-new-alias-2")}
    </Button>
  );
};

type AliasTypeMenuProps = {
  subdomain: string;
  onCreate: (
    options:
      | { mask_type: "random" }
      | { mask_type: "custom"; address: string; blockPromotionals: boolean },
    setAliasGeneratedState?: (flag: boolean) => void,
  ) => void;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
  findAliasDataFromPrefix: (aliasPrefix: string) => AliasData | undefined;
  setGeneratedAlias: (alias: AliasData | undefined) => void;
  runtimeData?: RuntimeData;
};
const AliasTypeMenu = (props: AliasTypeMenuProps) => {
  const l10n = useL10n();
  const modalState = useOverlayTriggerState({});
  const [aliasGeneratedState, setAliasGeneratedState] = useState(false);

  const onAction = (key: Key) => {
    if (key === "random") {
      props.onCreate({ mask_type: "random" });
      return;
    }
    if (key === "custom") {
      modalState.open();
    }
  };

  const onPick = (address: string, setErrorState: (flag: boolean) => void) => {
    props.onCreate(
      {
        mask_type: "custom",
        address: address,
        blockPromotionals: false,
      },
      (isCreated: boolean) => {
        setAliasGeneratedState(isCreated);
        if (!isCreated) {
          setErrorState(true);
        } // Shows the error banner within the modal
      },
    );
  };

  const onPickNonRedesign = (
    address: string,
    settings: { blockPromotionals: boolean },
  ) => {
    props.onCreate({
      mask_type: "custom",
      address: address,
      blockPromotionals: settings.blockPromotionals,
    });
    modalState.close();
  };

  const onSuccessClose = (
    aliasToUpdate: AliasData | undefined,
    blockPromotions: boolean,
    copyToClipboard: boolean | undefined,
  ) => {
    if (aliasToUpdate && blockPromotions) {
      props.onUpdate(aliasToUpdate, {
        enabled: true,
        block_list_emails: blockPromotions,
      });
    }
    if (copyToClipboard) {
      props.setGeneratedAlias(aliasToUpdate);
    }
    modalState.close();
  };

  const dialog = modalState.isOpen ? (
    isFlagActive(props.runtimeData, "custom_domain_management_redesign") ? (
      <CustomAddressGenerationModal
        isOpen={modalState.isOpen}
        onClose={() => modalState.close()}
        onUpdate={onSuccessClose}
        onPick={onPick}
        subdomain={props.subdomain}
        aliasGeneratedState={aliasGeneratedState}
        findAliasDataFromPrefix={props.findAliasDataFromPrefix}
      />
    ) : (
      <AddressPickerModal
        isOpen={modalState.isOpen}
        onClose={() => modalState.close()}
        onPick={onPickNonRedesign}
        subdomain={props.subdomain}
      />
    )
  ) : null;

  useEffect(() => {
    if (!modalState.isOpen) {
      setAliasGeneratedState(false);
    }
  }, [modalState]);

  return (
    <>
      <AliasTypeMenuButton onAction={onAction}>
        <Item key="random">
          {l10n.getString("profile-label-generate-new-alias-menu-random-2")}
        </Item>
        <Item key="custom">
          {l10n.getString("profile-label-generate-new-alias-menu-custom-2", {
            subdomain: props.subdomain,
          })}
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
  const l10n = useL10n();
  const triggerState = useMenuTriggerState(props);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger(
    {},
    triggerState,
    triggerRef,
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
    triggerRef,
  ).buttonProps;

  return (
    <div className={styles["button-wrapper"]}>
      <Button ref={triggerRef} {...triggerButtonProps}>
        {l10n.getString("profile-label-generate-new-alias-2")}
        <ArrowDownIcon alt="" width={16} height={16} />
      </Button>
      {triggerState.isOpen && (
        <AliasTypeMenuPopup
          {...props}
          aria-label={l10n.getString("profile-label-generate-new-alias-2")}
          domProps={menuPropsWithoutAutofocus}
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
  onClose?: AriaOverlayProps["onClose"];
  autoFocus?: MenuTriggerState["focusStrategy"];
};
const AliasTypeMenuPopup = (props: AliasTypeMenuPopupProps) => {
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
