import { useLocalization } from "@fluent/react";
import { Key, ReactNode, useRef } from "react";
import { useMenu, useMenuItem } from "react-aria";
import { Item, TreeProps, TreeState, useTreeState } from "react-stately";
import EmptyStateHero from "./images/empty-hero.png";
import styles from "./WhatsNewList.module.scss";
import { WhatsNewEntry } from "./WhatsNewMenu";

export type Props = {
  entries: WhatsNewEntry[];
  onSelect: (entry: WhatsNewEntry) => void;
  "aria-label": string;
};

export const WhatsNewList = (props: Props) => {
  const { l10n } = useLocalization();

  if (props.entries.length === 0) {
    return (
      <div className={styles["empty-message"]}>
        <img src={EmptyStateHero.src} alt="" />
        <p>{l10n.getString("whatsnew-empty-message")}</p>
      </div>
    );
  }

  return (
    <WhatsNewListMenu
      aria-label={props["aria-label"]}
      onSelect={(key) => {
        const selectedItem = props.entries.find(
          (entry) => encodeURI(entry.title) === key
        );
        /* istanbul ignore if [Types can't represent that a `selectedItem` should always be found, but it should.] */
        if (!selectedItem) {
          console.error(
            `WhatsNewListMenu.onSelect: [${key}] not found in the contained Items.`
          );
          return;
        }
        props.onSelect(selectedItem);
      }}
    >
      {props.entries.map((entry) => {
        return (
          <Item key={encodeURI(entry.title)} textValue={entry.title}>
            <img src={entry.icon} alt="" />
            <div className={styles.text}>
              <h3>{entry.title}</h3>
              <p>{entry.snippet}</p>
            </div>
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
    menuRef
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
    key: Key;
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
    menuItemRef
  );

  return (
    <li {...menuItemProps} ref={menuItemRef}>
      <div className={styles.item}>{props.item.rendered}</div>
    </li>
  );
};
