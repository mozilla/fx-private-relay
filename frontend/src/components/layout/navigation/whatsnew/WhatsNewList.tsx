import Image from "next/image";
import { Key, ReactNode, useRef } from "react";
import { useMenu, useMenuItem } from "react-aria";
import { Item, TreeProps, TreeState, useTreeState } from "react-stately";
import { useGaViewPing } from "../../../../hooks/gaViewPing";
import { useL10n } from "../../../../hooks/l10n";
import EmptyStateHero from "./images/empty-hero.png";
import styles from "./WhatsNewList.module.scss";
import { WhatsNewEntry } from "./WhatsNewMenu";

export type Props = {
  entries: WhatsNewEntry[];
  onSelect: (entry: WhatsNewEntry) => void;
  "aria-label": string;
};

export const WhatsNewList = (props: Props) => {
  const l10n = useL10n();

  if (props.entries.length === 0) {
    return (
      <div className={styles["empty-message"]}>
        <Image src={EmptyStateHero} alt="" />
        <p>{l10n.getString("whatsnew-empty-message")}</p>
      </div>
    );
  }

  return (
    <WhatsNewListMenu
      aria-label={props["aria-label"]}
      onSelect={(key) => {
        const selectedItem = props.entries.find(
          (entry) => encodeURI(entry.title) === key,
        );
        /* istanbul ignore if [Types can't represent that a `selectedItem` should always be found, but it should.] */
        if (!selectedItem) {
          console.error(
            `WhatsNewListMenu.onSelect: [${key}] not found in the contained Items.`,
          );
          return;
        }
        props.onSelect(selectedItem);
      }}
    >
      {props.entries.map((entry) => {
        return (
          <Item key={encodeURI(entry.title)} textValue={entry.title}>
            <ItemWrapper entry={entry} />
          </Item>
        );
      })}
    </WhatsNewListMenu>
  );
};

type WhatsNewListMenuProps = TreeProps<object> & {
  onSelect: (key: Key) => void;
};
const WhatsNewListMenu = (props: WhatsNewListMenuProps) => {
  const menuState = useTreeState(props);

  const menuRef = useRef<HTMLUListElement>(null);
  const { menuProps } = useMenu(
    { selectionMode: "single", ...props },
    menuState,
    menuRef,
  );

  return (
    <ul {...menuProps} ref={menuRef} className={styles.list}>
      {Array.from(menuState.collection).map((item) => {
        return (
          <WhatsNewListMenuItem
            key={item.key}
            item={item}
            state={menuState}
            onSelect={() => props.onSelect(item.key)}
          />
        );
      })}
    </ul>
  );
};

type WhatsNewListMenuItemProps = {
  item: {
    key: Parameters<typeof useMenuItem>[0]["key"];
    rendered: ReactNode;
  };
  state: TreeState<object>;
  onSelect: () => void;
};
const WhatsNewListMenuItem = (props: WhatsNewListMenuItemProps) => {
  const menuItemRef = useRef<HTMLLIElement>(null);

  const { menuItemProps } = useMenuItem(
    {
      key: props.item.key,
      onAction: () => props.onSelect(),
    },
    props.state,
    menuItemRef,
  );

  return (
    <li {...menuItemProps} ref={menuItemRef}>
      <div className={styles.item}>{props.item.rendered}</div>
    </li>
  );
};

type ItemWrapperProps = {
  entry: WhatsNewEntry;
};
const ItemWrapper = (props: ItemWrapperProps) => {
  const wrapperRef = useGaViewPing({
    category: "News",
    label: props.entry.title + " (snippet)",
  });

  return (
    <div ref={wrapperRef} className={styles.item}>
      <Image src={props.entry.icon} alt="" />
      <div className={styles.text}>
        <h3>{props.entry.title}</h3>
        <p>{props.entry.snippet}</p>
      </div>
    </div>
  );
};
