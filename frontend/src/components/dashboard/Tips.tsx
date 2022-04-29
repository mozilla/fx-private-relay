import { useRef, Key, ReactNode } from "react";
import { useLocalization } from "@fluent/react";
import Link from "next/link";
import { useTabList, useTabPanel, useTab } from "react-aria";
import { useTabListState, TabListState, Item } from "react-stately";
import styles from "./Tips.module.scss";
import { InfoIcon, CloseIcon } from "../Icons";
import { ProfileData } from "../../hooks/api/profile";
import { useLocalDismissal } from "../../hooks/localDismissal";
import { getRuntimeConfig } from "../../config";
import { CustomAliasData } from "../../hooks/api/aliases";

export type Props = {
  profile: ProfileData;
  customAliases: CustomAliasData[];
};

/**
 * Panel to be used on the bottom of the page, displaying tips relevant to the user.
 */
export const Tips = (props: Props) => {
  const { l10n } = useLocalization();
  const dismissals = {
    customAlias: useLocalDismissal(`tips_customAlias_${props.profile.id}`),
    criticalEmails: useLocalDismissal(
      `tips_criticalEmails_${props.profile.id}`
    ),
    addonSignin: useLocalDismissal(`tips_addonSignin_${props.profile.id}`),
  };
  dismissals.customAlias.isDismissed;

  const tips: Record<Key, ReactNode> = {};

  // If the user has a custom subdomain, but does not have custom aliases yet,
  // show a tip about how they get created:
  if (
    typeof props.profile.subdomain === "string" &&
    props.customAliases.length === 0 &&
    getRuntimeConfig().featureFlags.generateCustomAliasTip === true &&
    !dismissals.customAlias.isDismissed
  ) {
    tips.customAlias = <CustomAliasTip subdomain={props.profile.subdomain} />;
  }

  if (
    getRuntimeConfig().featureFlags.criticalEmailsTip === true &&
    !dismissals.criticalEmails.isDismissed
  ) {
    tips.criticalEmails = <CriticalEmailsTip />;
  }

  if (
    getRuntimeConfig().featureFlags.addonSigninTip === true &&
    !dismissals.addonSignin.isDismissed
  ) {
    tips.addonSignin = <AddonSigninTip />;
  }

  if (Object.keys(tips).length === 0) {
    return null;
  }

  const dismissAll = () => {
    Object.values(dismissals).forEach((dismissal) => {
      dismissal.dismiss();
    });
  };

  return (
    <aside className={styles.wrapper}>
      <div className={styles.card}>
        <header className={styles.header}>
          <span className={styles.icon}>
            <InfoIcon alt="" width={20} height={20} />
          </span>
          <h2>{l10n.getString("tips-header-title")}</h2>
          <button
            onClick={() => dismissAll()}
            className={styles["close-button"]}
          >
            <CloseIcon
              alt={l10n.getString("tips-header-button-close-label")}
              width={20}
              height={20}
            />
          </button>
        </header>
        <div className={styles["tip-carousel"]}>
          <TipsCarousel defaultSelectedKey={Object.keys(tips)[0]}>
            {Object.entries(tips).map(([key, tip]) => (
              <Item key={key}>{tip}</Item>
            ))}
          </TipsCarousel>
        </div>
        <footer className={styles.footer}>
          <ul>
            <li>
              <Link href="/faq">
                <a title={l10n.getString("tips-footer-link-faq-tooltip")}>
                  {l10n.getString("tips-footer-link-faq-label")}
                </a>
              </Link>
            </li>
            <li>
              <a
                href={`https://support.mozilla.org/products/relay/?utm_source=${
                  getRuntimeConfig().frontendOrigin
                }`}
                target="_blank"
                rel="noopener noreferrer"
                title={l10n.getString("tips-footer-link-support-tooltip")}
              >
                {l10n.getString("tips-footer-link-support-label")}
              </a>
            </li>
          </ul>
        </footer>
      </div>
    </aside>
  );
};

type CustomAliasTipProps = {
  subdomain: string;
};
const CustomAliasTip = (props: CustomAliasTipProps) => {
  const { l10n } = useLocalization();

  return (
    <div className={styles["custom-alias-tip"]}>
      <samp>
        @{props.subdomain}.{getRuntimeConfig().mozmailDomain}
      </samp>
      <h3>{l10n.getString("tips-custom-alias-heading-2")}</h3>
      <p>{l10n.getString("tips-custom-alias-content-2")}</p>
    </div>
  );
};

// Note: Content of this tip is not yet final, and an animation will be added:
const CriticalEmailsTip = () => {
  const { l10n } = useLocalization();

  return (
    <div className={styles["critical-emails-tip"]}>
      <h3>{l10n.getString("tips-critical-emails-heading")}</h3>
      <p>{l10n.getString("tips-critical-emails-content")}</p>
    </div>
  );
};

// Note: Content of this tip is not yet final, and an animation will be added:
const AddonSigninTip = () => {
  const { l10n } = useLocalization();

  return (
    <div className={styles["addon-signin"]}>
      <h3>{l10n.getString("tips-addon-signin-heading")}</h3>
      <p>{l10n.getString("tips-addon-signin-content")}</p>
    </div>
  );
};

const TipsCarousel = (props: Parameters<typeof useTabListState>[0]) => {
  const tabListState = useTabListState(props);
  const tabListRef = useRef<HTMLDivElement>(null);
  const { tabListProps } = useTabList(
    { ...props, orientation: "horizontal" },
    tabListState,
    tabListRef
  );

  const tipSwitcher =
    tabListState.collection.size === 1
      ? null
      : Array.from(tabListState.collection).map((item) => (
          <PanelDot key={item.key} item={item} tabListState={tabListState} />
        ));

  return (
    <div>
      <TipPanel
        key={tabListState.selectedItem.key}
        tabListState={tabListState}
      />
      <div
        {...tabListProps}
        ref={tabListRef}
        className={styles["tip-switcher"]}
      >
        {tipSwitcher}
      </div>
    </div>
  );
};

type PanelDotProps = {
  item: {
    key: Key;
    rendered: ReactNode;
    index?: number;
  };
  tabListState: TabListState<object>;
};
const PanelDot = (props: PanelDotProps) => {
  const { l10n } = useLocalization();
  const dotRef = useRef<HTMLDivElement>(null);
  const { tabProps } = useTab(
    { key: props.item.key },
    props.tabListState,
    dotRef
  );
  const isSelected = props.tabListState.selectedKey === props.item.key;
  const alt = l10n.getString("tips-switcher-label", {
    nr: (props.item.index ?? 0) + 1,
  });
  return (
    <div
      {...tabProps}
      ref={dotRef}
      className={`${styles["panel-dot"]} ${
        isSelected ? styles["is-selected"] : ""
      }`}
    >
      <svg
        role="img"
        aria-label={alt}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 8 8"
        width={8}
        height={8}
      >
        <title>{alt}</title>
        <circle
          style={{
            fill: "currentcolor",
          }}
          cx="4"
          cy="4"
          r="4"
        />
      </svg>
    </div>
  );
};

const TipPanel = ({
  tabListState,
  ...props
}: { tabListState: TabListState<object> } & Parameters<
  typeof useTabPanel
>[0]) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { tabPanelProps } = useTabPanel(props, tabListState, panelRef);

  return (
    <div {...tabPanelProps} ref={panelRef} className={styles.tip}>
      {tabListState.selectedItem.props.children}
    </div>
  );
};
