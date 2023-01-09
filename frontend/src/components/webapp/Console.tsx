import {
  Item,
  TabListProps,
  TabListState,
  useTabListState,
} from "react-stately";
import { Key, ReactNode, useRef } from "react";
import styles from "./Console.module.scss";
import { PageMetadata } from "../layout/PageMetadata";
import { RelayNumber } from "../../hooks/api/relayNumber";
import { Stats } from "./Stats";
import { AriaTabPanelProps, useTab, useTabList, useTabPanel } from "react-aria";
import { Node } from "@react-types/shared";
import { ContactIcon, PerformanceIcon, PhoneIcon } from "../Icons";
import { Call } from "./Call";
import { useL10n } from "../../hooks/l10n";
import { MessagesData } from "../../hooks/api/messages";
import { Text } from "./Text";

export type Props = {
  relayNumber: RelayNumber;
  messages: MessagesData;
};

export const Console = (props: Props) => {
  const l10n = useL10n();

  return (
    <div className={styles.wrapper}>
      <PageMetadata />
      <Sheets aria-label={l10n.getString("webapp-tabs-label")}>
        <Item key="stats" title={l10n.getString("webapp-tab-stats-label")}>
          <Stats relayNumber={props.relayNumber} />
        </Item>
        <Item
          key="messages"
          title={l10n.getString("webapp-tab-messages-label")}
        >
          <Text relayNumber={props.relayNumber} messages={props.messages} />
        </Item>
        <Item key="dialer" title={l10n.getString("webapp-tab-dialer-label")}>
          <Call relayNumber={props.relayNumber} />
        </Item>
      </Sheets>
    </div>
  );
};

// Workaround for https://github.com/adobe/react-spectrum/discussions/3891
const icons: Record<Key, ReactNode> = {
  stats: <PerformanceIcon alt="" height={30} />,
  messages: <ContactIcon alt="" height={30} />,
  dialer: <PhoneIcon alt="" height={30} />,
};

const Sheets = (props: TabListProps<object>) => {
  const state = useTabListState(props);
  const sheetListRef = useRef<HTMLDivElement>(null);

  const { tabListProps } = useTabList(props, state, sheetListRef);

  return (
    <div className={styles["sheets-wrapper"]}>
      <Sheet key={state.selectedItem?.key} state={state} />
      <div
        {...tabListProps}
        ref={sheetListRef}
        className={styles["sheet-list"]}
      >
        {Array.from(state.collection).map((item) => (
          <Tab key={item.key} item={item} state={state} />
        ))}
      </div>
    </div>
  );
};

const Tab = (props: { item: Node<object>; state: TabListState<object> }) => {
  const tabRef = useRef<HTMLDivElement>(null);

  const { tabProps } = useTab({ key: props.item.key }, props.state, tabRef);

  return (
    <div
      {...tabProps}
      ref={tabRef}
      className={`${styles.tab} ${
        props.state.selectedItem === props.item ? styles["is-active"] : ""
      }`}
    >
      {icons[props.item.key]}
      {props.item.rendered}
    </div>
  );
};

const Sheet = (props: AriaTabPanelProps & { state: TabListState<object> }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { tabPanelProps } = useTabPanel(props, props.state, sheetRef);

  return (
    <div {...tabPanelProps} ref={sheetRef} className={styles.sheet}>
      {props.state.selectedItem?.props.children}
    </div>
  );
};
