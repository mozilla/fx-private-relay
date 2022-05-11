import { useRef, Key, ReactNode, useState } from "react";
import { useLocalization } from "@fluent/react";
import Link from "next/link";
import { useTabList, useTabPanel, useTab } from "react-aria";
import { useTabListState, TabListState, Item } from "react-stately";
import { useInView } from "react-intersection-observer";
import styles from "./Tips.module.scss";
import arrowDownIcon from "../../../../../static/images/arrowhead.svg";
import { InfoIcon } from "../../Icons";
import { ProfileData } from "../../../hooks/api/profile";
import {
  DismissalData,
  useLocalDismissal,
} from "../../../hooks/localDismissal";
import { getRuntimeConfig } from "../../../config";
import { CustomAliasTip } from "./CustomAliasTip";

export type Props = {
  profile: ProfileData;
};

export type TipEntry = {
  title: string;
  content: ReactNode;
  dismissal: DismissalData;
};

/**
 * Panel to be used on the bottom of the page, displaying tips relevant to the user.
 */
export const Tips = (props: Props) => {
  const { l10n } = useLocalization();
  const [isExpanded, setIsExpanded] = useState(false);
  const [wrapperRef, wrapperIsInView] = useInView({ threshold: 1 });

  const tips: TipEntry[] = [];

  // If the user has a custom subdomain, but does not have custom aliases yet,
  // show a tip about how they get created:
  const customAliasDismissal = useLocalDismissal(
    `tips_customAlias_${props.profile.id}`
  );
  tips.push({
    title: l10n.getString("tips-custom-alias-heading-2"),
    content: (
      <CustomAliasTip subdomain={props.profile.subdomain ?? undefined} />
    ),
    dismissal: customAliasDismissal,
  });

  if (tips.length === 0) {
    return null;
  }

  const minimise = () => {
    tips.forEach((tipEntry) => {
      tipEntry.dismissal.dismiss();
    });
    setIsExpanded(false);
  };

  let elementToShow = (
    <div className={styles.card}>
      <header className={styles.header}>
        <span className={styles.icon}>
          <InfoIcon alt="" width={20} height={20} />
        </span>
        <h2>{l10n.getString("tips-header-title")}</h2>
        <button onClick={() => minimise()} className={styles["close-button"]}>
          <img
            src={arrowDownIcon.src}
            alt={l10n.getString("tips-header-button-close-label")}
            width={20}
            height={20}
          />
        </button>
      </header>
      <div className={styles["tip-carousel"]}>
        <TipsCarousel defaultSelectedKey={"tip_0"}>
          {tips.map((tip, index) => (
            <Item key={`tip_${index}`}>{tip.content}</Item>
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
  );

  if (!isExpanded) {
    elementToShow = tips.every((tipEntry) => tipEntry.dismissal.isDismissed) ? (
      // If there are no active tips that have not been seen yet,
      // just show a small button that allows pulling up the panel again:
      <button
        className={styles["expand-button"]}
        onClick={() => setIsExpanded(true)}
      >
        <span className={styles.icon}>
          <InfoIcon alt="" width={20} height={20} />
        </span>
        <span>{l10n.getString("tips-header-title")}</span>
      </button>
    ) : (
      <div className={styles.card}>
        <header className={styles.header}>
          <span className={styles.icon}>
            <InfoIcon alt="" width={20} height={20} />
          </span>
          <h2>{l10n.getString("tips-header-title")}</h2>
          <button
            onClick={() => minimise()}
            className={styles["close-button"]}
            aria-label={l10n.getString("tips-header-button-close-label")}
          >
            <img
              src={arrowDownIcon.src}
              alt={l10n.getString("tips-header-button-close-label")}
              width={20}
              height={20}
            />
          </button>
        </header>
        <div className={styles.summary}>
          <b>{tips[0].title}</b>
          <button onClick={() => setIsExpanded(true)}>
            {l10n.getString("tips-toast-button-expand-label")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside
      ref={wrapperRef}
      aria-label={l10n.getString("tips-header-title")}
      className={`${styles.wrapper} ${
        wrapperIsInView ? styles["is-in-view"] : styles["is-out-of-view"]
      }`}
    >
      {elementToShow}
    </aside>
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
      <div className={styles["focus-wrapper"]}>
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
