import { Key, ReactNode, useEffect, useRef } from "react";
import { useTab, useTabList, useTabPanel } from "react-aria";
import { Item, TabListState, useTabListState } from "react-stately";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import styles from "./Carousel.module.scss";

// Next.js doesn't export this type at the time of writing,
// so it's duplicated here:
type StaticImageData = {
  src: string;
  height: number;
  width: number;
};

export type CarouselTab = {
  heading: string;
  illustration: StaticImageData;
  color: "yellow" | "orange" | "teal" | "red" | "pink";
  content: ReactNode;
  id: string;
};

export type Props = {
  tabs: CarouselTab[];
  title: string;
};

/**
 * Carousel highlighting different use cases of Relay, that people can tab through to learn more.
 */
export const Carousel = (props: Props) => {
  return (
    <Tabs aria-label={props.title} defaultSelectedKey={props.tabs[0].id}>
      {props.tabs.map((tab) => {
        const titleElement = (
          <div className={`${styles.title} ${styles[tab.color]}`}>
            <img src={tab.illustration.src} alt="" />
            <span className={styles.titleText}>{tab.heading}</span>
          </div>
        );
        return (
          <Item key={tab.id} title={titleElement} aria-label={tab.heading}>
            {tab.content}
          </Item>
        );
      })}
    </Tabs>
  );
};

type TabsProps = {
  children: Parameters<typeof useTabListState>[0]["children"];
  defaultSelectedKey: Key;
};
const Tabs = (props: TabsProps) => {
  const state = useTabListState(props);
  const tabsRef = useRef<HTMLDivElement>(null);
  const isLargeScreen = useMinViewportWidth("lg");
  const { tabListProps } = useTabList(
    { ...props, orientation: isLargeScreen ? "horizontal" : "vertical" },
    state,
    tabsRef
  );

  useEffect(() => {
    function selectByHash() {
      const selectedItem = Array.from(state.collection).find(
        (item) => item.key === document.location.hash.substring("#".length)
      );
      if (typeof selectedItem !== "undefined") {
        state.setSelectedKey(selectedItem.key);
      }
    }
    selectByHash();
    window.addEventListener("hashchange", selectByHash);
    return () => {
      window.removeEventListener("hashchange", selectByHash);
    };
    // Only run this logic once, to select a tab when rendering in the browser
    // with an anchor link pointing to that tab.
    // Otherwise, the tab will be reset to the anchor link on every state change.
    // We'd use `defaultSelectedKey` on <Tabs>, but that doesn't work since we're
    // prerendering the page in the build, when document.location.hash is not
    // available:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      {...tabListProps}
      ref={tabsRef}
      className={`${styles.sections} ${
        styles["selected_tab_" + state.selectedItem.index]
      }`}
    >
      {Array.from(state.collection).map((item) => (
        <Tab key={item.key} item={item} state={state} />
      ))}
      <Container key={state.selectedItem.key} state={state} />
    </div>
  );
};

type TabProps = {
  item: {
    key: Key;
    rendered: ReactNode;
  };
  state: TabListState<unknown>;
};
const Tab = (props: TabProps) => {
  const tabRef = useRef<HTMLDivElement>(null);
  const { tabProps } = useTab({ key: props.item.key }, props.state, tabRef);
  const isSelected = props.state.selectedKey === props.item.key;

  return (
    <div
      {...tabProps}
      ref={tabRef}
      className={`${styles.tab} ${isSelected ? styles.isSelected : ""}`}
      data-tab-key={props.item.key}
      id={props.item.key.toString()}
    >
      {props.item.rendered}
    </div>
  );
};

// Unfortunately react-aria doesn't export AriaTabPanelProps directly:
type AriaTabPanelProps = Parameters<typeof useTabPanel>[0];
type ContainerProps = AriaTabPanelProps & { state: TabListState<unknown> };
const Container = ({ state, ...otherProps }: ContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { tabPanelProps } = useTabPanel(otherProps, state, containerRef);
  return (
    <div {...tabPanelProps} ref={containerRef} className={styles.content}>
      <div className={styles.contentHeading}>
        {state.selectedItem.props["aria-label"]}
      </div>
      <div className={styles.contentBody}>
        {state.selectedItem.props.children}
      </div>
    </div>
  );
};
