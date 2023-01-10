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
  AriaOverlayProps,
} from "react-aria";
import {
  HTMLAttributes,
  Key,
  ReactNode,
  useRef,
  useState,
  useEffect,
  RefObject,
} from "react";
import { AriaMenuItemProps } from "@react-aria/menu";
import { event as gaEvent } from "react-ga";
import styles from "./AppPicker.module.scss";
import FirefoxLogo from "../images/fx.png";
import MonitorLogo from "../images/monitor.png";
import PocketLogo from "../images/pocket.png";
import VpnLogo from "../images/vpn.svg";
import FxDesktopLogo from "../images/fx-logo.svg";
import FxMobileLogo from "../images/fx-mobile.png";
import { Props as LayoutProps } from "../Layout";
import { getRuntimeConfig } from "../../../config";
import { BentoIcon } from "../../Icons";
import { useL10n } from "../../../hooks/l10n";

const getProducts = (referringSiteUrl: string) => ({
  monitor: {
    id: "monitor",
    url: `https://monitor.firefox.com/?utm_source=${encodeURIComponent(
      referringSiteUrl
    )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`,
    gaLabel: "fx-monitor",
  },
  pocket: {
    id: "pocket",
    url: "https://app.adjust.com/hr2n0yz?engagement_type=fallback_click&fallback=https%3A%2F%2Fgetpocket.com%2Ffirefox_learnmore%3Fsrc%3Dff_bento&fallback_lp=https%3A%2F%2Fapps.apple.com%2Fapp%2Fpocket-save-read-grow%2Fid309601447",
    gaLabel: "pocket",
  },
  fxDesktop: {
    id: "fxDesktop",
    url: `https://www.mozilla.org/firefox/new/?utm_source=${encodeURIComponent(
      referringSiteUrl
    )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`,
    gaLabel: "fx-desktop",
  },
  fxMobile: {
    id: "fxMobile",
    url: `https://www.mozilla.org/firefox/browsers/mobile/?utm_source=${encodeURIComponent(
      referringSiteUrl
    )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`,
    gaLabel: "fx-mobile",
  },
  vpn: {
    id: "vpn",
    url: `https://www.mozilla.org/products/vpn/?utm_source=${encodeURIComponent(
      referringSiteUrl
    )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`,
    gaLabel: "vpn",
  },
});

export type Props = {
  theme?: LayoutProps["theme"];
  style: string;
};

/**
 * Menu that can be opened to see other relevant products Mozilla has available for people.
 */
export const AppPicker = (props: Props) => {
  const l10n = useL10n();

  const products = getProducts(
    typeof document !== "undefined"
      ? document.location.host
      : "relay.firefox.com"
  );
  const linkRefs: Record<
    keyof typeof products,
    RefObject<HTMLAnchorElement>
  > = {
    monitor: useRef<HTMLAnchorElement>(null),
    pocket: useRef<HTMLAnchorElement>(null),
    fxDesktop: useRef<HTMLAnchorElement>(null),
    fxMobile: useRef<HTMLAnchorElement>(null),
    vpn: useRef<HTMLAnchorElement>(null),
  };
  const mozillaLinkRef = useRef<HTMLAnchorElement>(null);

  const onSelect = (itemKey: Key) => {
    Object.entries(products).forEach(([key, productData]) => {
      if (itemKey === productData.id) {
        linkRefs[key as keyof typeof products].current?.click();
        gaEvent({
          category: "bento",
          action: "bento-app-link-click",
          label: productData.gaLabel,
        });
      }
    });
    if (itemKey === "mozilla") {
      mozillaLinkRef.current?.click();
      gaEvent({
        category: "bento",
        action: "bento-app-link-click",
        label: "Mozilla",
      });
    }
  };

  return (
    <AppPickerTrigger
      label={l10n.getString("bento-button-title")}
      onAction={onSelect}
      theme={props.theme}
      style={props.style}
    >
      <Item key={products.vpn.id} textValue={l10n.getString("fx-vpn")}>
        <a
          ref={linkRefs.vpn}
          href={products.vpn.url}
          className={`${styles["menu-link"]} ${styles["vpn-link"]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={VpnLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-vpn")}
        </a>
      </Item>
      <Item key={products.monitor.id} textValue={l10n.getString("fx-monitor")}>
        <a
          ref={linkRefs.monitor}
          href={products.monitor.url}
          className={`${styles["menu-link"]} ${styles["monitor-link"]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={MonitorLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-monitor")}
        </a>
      </Item>
      <Item key={products.pocket.id} textValue={l10n.getString("fx-pocket")}>
        <a
          ref={linkRefs.pocket}
          href={products.pocket.url}
          className={`${styles["menu-link"]} ${styles["pocket-link"]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={PocketLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-pocket")}
        </a>
      </Item>
      <Item
        key={products.fxDesktop.id}
        textValue={l10n.getString("fx-desktop-2")}
      >
        <a
          ref={linkRefs.fxDesktop}
          href={products.fxDesktop.url}
          className={`${styles["menu-link"]} ${styles["fx-desktop-link"]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={FxDesktopLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-desktop-2")}
        </a>
      </Item>
      <Item
        key={products.fxMobile.id}
        textValue={l10n.getString("fx-mobile-2")}
      >
        <a
          ref={linkRefs.fxMobile}
          href={products.fxMobile.url}
          className={`${styles["menu-link"]} ${styles["fx-mobile-link"]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={FxMobileLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-mobile-2")}
        </a>
      </Item>

      <Item key="mozilla" textValue={l10n.getString("made-by-mozilla")}>
        <a
          ref={mozillaLinkRef}
          href={`https://www.mozilla.org/?utm_source=${encodeURIComponent(
            getRuntimeConfig().frontendOrigin
          )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`}
          className={`${styles["menu-link"]} ${styles["mozilla-link"]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {l10n.getString("made-by-mozilla")}
        </a>
      </Item>
    </AppPickerTrigger>
  );
};

type AppPickerTriggerProps = Parameters<typeof useMenuTriggerState>[0] & {
  label: string;
  style: string;
  children: TreeProps<Record<string, never>>["children"];
  onAction: AriaMenuItemProps["onAction"];
  theme?: LayoutProps["theme"];
};
const AppPickerTrigger = ({
  label,
  theme,
  style,
  ...otherProps
}: AppPickerTriggerProps) => {
  const l10n = useL10n();
  const appPickerTriggerState = useMenuTriggerState(otherProps);
  const isFirstRenderDone = useRef(false);

  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger(
    {},
    appPickerTriggerState,
    triggerButtonRef
  );

  const triggerButtonProps = useButton(
    menuTriggerProps,
    triggerButtonRef
  ).buttonProps;

  useEffect(() => {
    if (!isFirstRenderDone.current) {
      isFirstRenderDone.current = true;
      return;
    }
    gaEvent({
      category: "bento",
      action: appPickerTriggerState.isOpen ? "bento-opened" : "bento-closed",
      label: getRuntimeConfig().frontendOrigin,
    });
  }, [appPickerTriggerState.isOpen]);

  return (
    <div className={`${styles.wrapper} ${style}`}>
      <button
        {...triggerButtonProps}
        ref={triggerButtonRef}
        title={l10n.getString("bento-button-title")}
        className={`${styles.trigger} ${
          theme === "premium" ? styles["is-premium"] : styles["is-free"]
        }`}
      >
        <BentoIcon
          alt={label}
          className={`${theme === "premium" ? styles.premium : ""}`}
        />
      </button>
      {appPickerTriggerState.isOpen && (
        <AppPickerPopup
          {...otherProps}
          aria-label={l10n.getString("bento-button-title")}
          domProps={menuProps}
          autoFocus={appPickerTriggerState.focusStrategy}
          onClose={() => appPickerTriggerState.close()}
        />
      )}
    </div>
  );
};

type AppPickerPopupProps = TreeProps<Record<string, never>> & {
  onAction: AriaMenuItemProps["onAction"];
  domProps: HTMLAttributes<HTMLElement>;
  onClose?: AriaOverlayProps["onClose"];
  autoFocus?: MenuTriggerState["focusStrategy"];
};
const AppPickerPopup = (props: AppPickerPopupProps) => {
  const l10n = useL10n();
  const popupState = useTreeState({ ...props, selectionMode: "none" });

  const popupRef = useRef<HTMLDivElement>(null);
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
        <div
          {...mergeProps(popupProps, props.domProps)}
          ref={popupRef}
          className={styles.popup}
        >
          <div className={styles["app-picker-heading"]}>
            <img src={FirefoxLogo.src} alt="" width={32} height={32} />
            <h2>{l10n.getString("fx-makes-tech")}</h2>
          </div>
          <ul>
            {Array.from(popupState.collection).map((item) => (
              <AppPickerItem
                key={item.key}
                // TODO: Fix the typing (likely: report to react-aria that the type does not include an isDisabled prop)
                item={item as unknown as AppPickerItemProps["item"]}
                state={popupState}
                onAction={props.onAction}
                onClose={props.onClose}
              />
            ))}
          </ul>
        </div>
        <DismissButton onDismiss={props.onClose} />
      </div>
    </FocusScope>
  );
};

type AppPickerItemProps = {
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

const AppPickerItem = (props: AppPickerItemProps) => {
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
      className={styles["menu-item-wrapper"]}
    >
      {props.item.rendered}
    </li>
  );
};
