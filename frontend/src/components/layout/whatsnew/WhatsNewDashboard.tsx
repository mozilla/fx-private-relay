import { useLocalization } from "@fluent/react";
import { Key, ReactNode, useRef, useState } from "react";
import { useTab, useTabList, useTabPanel } from "react-aria";
import { Item, TabListState, useTabListState } from "react-stately";
import { CloseIcon } from "../../Icons";
import styles from "./WhatsNewDashboard.module.scss";
import { WhatsNewList } from "./WhatsNewList";
import { WhatsNewEntry } from "./WhatsNewMenu";

export type Props = {
  new: WhatsNewEntry[];
  archive: WhatsNewEntry[];
  onClose: () => void;
};

export const WhatsNewDashboard = (props: Props) => {
  const { l10n } = useLocalization();
  const [expandedEntry, setExpandedEntry] = useState<WhatsNewEntry>();
  const onClearAll =
    props.new.length > 0
      ? () => props.new.forEach((entry) => entry.dismissal.dismiss())
      : undefined;

  const selectEntry = (entry: WhatsNewEntry) => {
    setExpandedEntry(entry);
    entry.dismissal.dismiss();
  };

  return (
    <div className={styles.wrapper}>
      <Tabs
        onClose={props.onClose}
        aria-label={l10n.getString("whatsnew-trigger-label")}
        defaultSelectedKey="new"
        expandedEntry={expandedEntry}
        onSelectionChange={() => setExpandedEntry(undefined)}
        onCollapseEntry={() => setExpandedEntry(undefined)}
        onClearAll={onClearAll}
      >
        <Item key="new" title={l10n.getString("whatsnew-tab-new-label")}>
          <WhatsNewList
            entries={props.new}
            onSelect={selectEntry}
            aria-label={l10n.getString("whatsnew-tab-new-label")}
          />
        </Item>
        <Item
          key="archive"
          title={l10n.getString("whatsnew-tab-archive-label")}
        >
          <WhatsNewList
            entries={props.archive}
            onSelect={selectEntry}
            aria-label={l10n.getString("whatsnew-tab-archive-label")}
          />
        </Item>
      </Tabs>
    </div>
  );
};

type TabProps = Parameters<typeof useTabListState>[0] & {
  onClose: () => void;
  onCollapseEntry: () => void;
  expandedEntry?: WhatsNewEntry;
  /** Should be undefined if there are no entries to clear; the "Clear all" link will then not show up. */
  onClearAll?: () => void;
};
const Tabs = (props: TabProps) => {
  const { l10n } = useLocalization();
  const tabListState = useTabListState(props);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { tabListProps } = useTabList(props, tabListState, wrapperRef);

  const footerStartControl = props.expandedEntry ? (
    <button onClick={() => props.onCollapseEntry()}>
      {l10n.getString("whatsnew-footer-back-label")}
    </button>
  ) : null;
  const footerEndControl =
    !props.expandedEntry &&
    tabListState.selectedKey === "new" &&
    typeof props.onClearAll === "function" ? (
      <button onClick={props.onClearAll}>
        {l10n.getString("whatsnew-footer-clear-all-label")}
      </button>
    ) : null;

  const footer =
    footerStartControl === null && footerEndControl === null ? null : (
      <footer className={styles["footer-controls"]}>
        <div className={styles["controls-wrapper"]}>
          <span className={styles.start}>{footerStartControl}</span>
          <span className={styles.end}>{footerEndControl}</span>
        </div>
      </footer>
    );

  return (
    <section {...tabListProps} ref={wrapperRef}>
      <header className={styles.controls}>
        <div className={styles["switch-wrapper"]}>
          <div className={styles.switch}>
            {Array.from(tabListState.collection).map((item) => {
              return (
                <SwitchTab key={item.key} item={item} state={tabListState} />
              );
            })}
          </div>
        </div>
        <button
          onClick={() => props.onClose()}
          className={styles["close-button"]}
          title={l10n.getString("whatsnew-close-label")}
        >
          <CloseIcon alt={l10n.getString("whatsnew-close-label")} />
        </button>
      </header>
      {props.expandedEntry ? (
        props.expandedEntry.content
      ) : (
        <TabContent key={tabListState.selectedKey} state={tabListState} />
      )}
      {footer}
    </section>
  );
};

type SwitchTabProps = {
  item: {
    key: Key;
    rendered: ReactNode;
  };
  state: TabListState<object>;
};
/** There are two tabs in the {@see WhatsNewDashboard}, styled like a Switch. */
const SwitchTab = (props: SwitchTabProps) => {
  const tabRef = useRef<HTMLDivElement>(null);
  const { tabProps } = useTab({ key: props.item.key }, props.state, tabRef);
  const isSelected = props.state.selectedKey === props.item.key;

  return (
    <div
      {...tabProps}
      ref={tabRef}
      className={`${styles["switch-tab"]} ${
        isSelected ? styles["is-selected"] : ""
      }`}
    >
      {props.item.rendered}
    </div>
  );
};

type TabContentProps = {
  state: TabListState<object>;
};
const TabContent = (props: TabContentProps) => {
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const { tabPanelProps } = useTabPanel({}, props.state, contentWrapperRef);

  return (
    <div {...tabPanelProps} ref={contentWrapperRef}>
      {props.state.selectedItem?.props?.children}
    </div>
  );
};
