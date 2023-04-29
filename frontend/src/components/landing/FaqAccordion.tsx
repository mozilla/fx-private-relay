import { ReactNode, useRef, useState } from "react";
import styles from "./FaqAccordion.module.scss";
import { PlusIcon } from "../Icons";

export type Entry = {
  q: string;
  a: ReactNode;
  expandedFirst?: boolean;
};

export type Props = {
  entries: Entry[];
};

/**
 * Highlight a selection of questions from the FAQ, allowing people to expand them to see the answers.
 */
export const FaqAccordionItem = (props: Props) => {
  const entries = props.entries.map((entry) => (
    <QAndA key={entry.q} entry={entry} />
  ));

  return <dl>{entries}</dl>;
};

const QAndA = (props: { entry: Entry }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isToggled, setIsToggled] = useState<boolean>(false);

  function setToggleView() {
    const isExpanded = styles["is-expanded"];
    const isCollapsed = styles["is-collapsed"];

    // Close the first item when its toggled, as opposed to expanding it
    if (isToggled && props.entry.expandedFirst) {
      return isCollapsed;
    }
    return isToggled || props.entry.expandedFirst ? isExpanded : isCollapsed;
  }

  return (
    <div className={`${styles.entry} ${setToggleView()}`}>
      <dt>
        <button
          onClick={() => {
            setIsToggled(!isToggled);
          }}
          ref={buttonRef}
        >
          <span>{props.entry.q}</span>
          <PlusIcon alt="" className={styles["plus-icon"]} />
        </button>
      </dt>
      <dd>{props.entry.a}</dd>
    </div>
  );
};
