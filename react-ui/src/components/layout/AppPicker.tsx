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
import {
  HTMLAttributes,
  Key,
  ReactNode,
  useRef,
  useState,
  useEffect,
} from "react";
import { AriaMenuItemProps } from "@react-aria/menu";
import { OverlayProps } from "@react-aria/overlays";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./AppPicker.module.scss";
import BentoIconGrey from "../../../../static/images/bento.svg";
import BentoIconWhite from "../../../../static/images/bento-white.svg";
import FirefoxLogo from "../../../../static/images/logos/bento/fx.png";
import MonitorLogo from "../../../../static/images/logos/bento/monitor.png";
import PocketLogo from "../../../../static/images/logos/bento/pocket.png";
import FxDesktopLogo from "../../../../static/images/logos/fx-logo.svg";
import FxMobileLogo from "../../../../static/images/logos/bento/fx-mobile.png";
import { Props as LayoutProps } from "./Layout";

const getProducts = (referringSiteUrl: string) => ({
  monitor: {
    id: "monitor",
    url: `https://monitor.firefox.com/?utm_source=${encodeURIComponent(
      referringSiteUrl
    )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`,
  },
  pocket: {
    id: "pocket",
    url: "https://app.adjust.com/hr2n0yz?engagement_type=fallback_click&fallback=https%3A%2F%2Fgetpocket.com%2Ffirefox_learnmore%3Fsrc%3Dff_bento&fallback_lp=https%3A%2F%2Fapps.apple.com%2Fapp%2Fpocket-save-read-grow%2Fid309601447",
  },
  fxDesktop: {
    id: "fxDesktop",
    url: `https://www.mozilla.org/firefox/new/?utm_source=${encodeURIComponent(
      referringSiteUrl
    )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`,
  },
  fxMobile: {
    id: "fxMobile",
    url: `https://www.mozilla.org/firefox/new/?utm_source=${encodeURIComponent(
      referringSiteUrl
    )}&utm_medium=referral&utm_campaign=bento&utm_content=desktop`,
  },
});

export const AppPicker = (props: { theme?: LayoutProps["theme"] } = {}) => {
  const { l10n } = useLocalization();

  const products = getProducts(process.env.NEXT_PUBLIC_SITE_ORIGIN!);
  const monitorLinkRef = useRef<HTMLAnchorElement>(null);
  const pocketLinkRef = useRef<HTMLAnchorElement>(null);
  const fxDesktopLinkRef = useRef<HTMLAnchorElement>(null);
  const fxMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const mozillaLinkRef = useRef<HTMLAnchorElement>(null);

  const onSelect = (itemKey: Key) => {
    if (itemKey === products.monitor.id) {
      monitorLinkRef.current?.click();
      gaEvent({
        category: "bento",
        action: "bento-app-link-click",
        label: "fx-monitor",
      });
    }
    if (itemKey === products.pocket.id) {
      pocketLinkRef.current?.click();
      gaEvent({
        category: "bento",
        action: "bento-app-link-click",
        label: "pocket",
      });
    }
    if (itemKey === products.fxDesktop.id) {
      fxDesktopLinkRef.current?.click();
      gaEvent({
        category: "bento",
        action: "bento-app-link-click",
        label: "fx-desktop",
      });
    }
    if (itemKey === products.fxMobile.id) {
      fxMobileLinkRef.current?.click();
      gaEvent({
        category: "bento",
        action: "bento-app-link-click",
        label: "fx-mobile",
      });
    }
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
    >
      <Item key={products.monitor.id} textValue={l10n.getString("fx-monitor")}>
        <a
          ref={monitorLinkRef}
          href={products.monitor.url}
          className={`${styles.menuLink} ${styles.monitorLink}`}
        >
          <img src={MonitorLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-monitor")}
        </a>
      </Item>
      <Item key={products.pocket.id} textValue={l10n.getString("fx-pocket")}>
        <a
          ref={pocketLinkRef}
          href={products.pocket.url}
          className={`${styles.menuLink} ${styles.pocketLink}`}
        >
          <img src={PocketLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-pocket")}
        </a>
      </Item>
      <Item
        key={products.fxDesktop.id}
        textValue={l10n.getString("fx-desktop")}
      >
        <a
          ref={fxDesktopLinkRef}
          href={products.fxDesktop.url}
          className={`${styles.menuLink} ${styles.fxDesktopLink}`}
        >
          <img src={FxDesktopLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-desktop")}
        </a>
      </Item>
      <Item key={products.fxMobile.id} textValue={l10n.getString("fx-mobile")}>
        <a
          ref={fxMobileLinkRef}
          href={products.fxMobile.url}
          className={`${styles.menuLink} ${styles.fxMobileLink}`}
        >
          <img src={FxMobileLogo.src} alt="" width={16} height={16} />
          {l10n.getString("fx-mobile")}
        </a>
      </Item>
      <Item key="mozilla" textValue={l10n.getString("made-by-mozilla")}>
        <a
          ref={fxMobileLinkRef}
          href={products.fxMobile.url}
          className={`${styles.menuLink} ${styles.mozillaLink}`}
        >
          {l10n.getString("made-by-mozilla")}
        </a>
      </Item>
    </AppPickerTrigger>
  );
};

type AppPickerTriggerProps = Parameters<typeof useMenuTriggerState>[0] & {
  label: string;
  children: TreeProps<{}>["children"];
  onAction: AriaMenuItemProps["onAction"];
  theme?: LayoutProps["theme"];
};
const AppPickerTrigger = ({
  label,
  theme,
  ...otherProps
}: AppPickerTriggerProps) => {
  const { l10n } = useLocalization();
  const appPickerTriggerState = useMenuTriggerState(otherProps);

  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  let { menuTriggerProps, menuProps } = useMenuTrigger(
    {},
    appPickerTriggerState,
    triggerButtonRef
  );

  let triggerButtonProps = useButton(
    menuTriggerProps,
    triggerButtonRef
  ).buttonProps;

  useEffect(() => {
    gaEvent({
      category: "bento",
      action: appPickerTriggerState.isOpen ? "bento-opened" : "bento-closed",
      label: process.env.NEXT_PUBLIC_SITE_ORIGIN!,
    });
  }, [appPickerTriggerState.isOpen]);

  return (
    <div className={styles.wrapper}>
      <button
        {...triggerButtonProps}
        ref={triggerButtonRef}
        title={l10n.getString("bento-button-title")}
        className={styles.trigger}
      >
        <img
          src={theme === "premium" ? BentoIconGrey.src : BentoIconWhite.src}
          alt={label}
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

type AppPickerPopupProps = TreeProps<{}> & {
  onAction: AriaMenuItemProps["onAction"];
  domProps: HTMLAttributes<HTMLElement>;
  onClose?: OverlayProps["onClose"];
  autoFocus?: MenuTriggerState["focusStrategy"];
};
const AppPickerPopup = (props: AppPickerPopupProps) => {
  const { l10n } = useLocalization();
  const popupState = useTreeState({ ...props, selectionMode: "none" });

  const popupRef = useRef<HTMLDivElement>(null);
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
        <div
          {...mergeProps(popupProps, props.domProps)}
          ref={popupRef}
          className={styles.popup}
        >
          <div className={styles.appPickerHeading}>
            <img src={FirefoxLogo.src} alt="" width={40} height={40} />
            <h2>{l10n.getString("fx-makes-tech")}</h2>
          </div>
          <ul>
            {Array.from(popupState.collection).map((item) => (
              <AppPickerItem
                key={item.key}
                // TODO: Fix the typing (likely: report to react-aria that the type does not include an isDisabled prop)
                item={item as any}
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
