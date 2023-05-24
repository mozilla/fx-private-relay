import { ReactNode, useRef, useState } from "react";
import styles from "./FaqAccordion.module.scss";
import { PlusIcon } from "../Icons";

export type Entry = {
  q: string;
  a: ReactNode;
};

export type Props = {
  entries: Entry[];
  defaultExpandedIndex?: number;
};

/**
 * Highlight a selection of questions from the FAQ, allowing people to expand them to see the answers.
 */
export const FaqAccordionItem = (props: Props) => {
  const [expandedIndex, setExpandedIndex] = useState(
    props.defaultExpandedIndex ?? 0
  );

  return (
    <dl>
      {props.entries.map((entry, index) => (
        <QAndA
          key={entry.q}
          entry={entry}
          isExpanded={expandedIndex === index}
          onToggle={() => setExpandedIndex(index)}
        />
      ))}
    </dl>
  );
};

const QAndA = (props: {
  entry: Entry;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  function setToggleView() {
    const isExpanded = styles["is-expanded"];
    const isCollapsed = styles["is-collapsed"];

    return props.isExpanded ? isExpanded : isCollapsed;
  }

  return (
    <div className={`${styles.entry} ${setToggleView()}`}>
      <dt>
        <button onClick={() => props.onToggle()} ref={buttonRef}>
          <span>{props.entry.q}</span>
          <PlusIcon alt="" className={styles["plus-icon"]} />
        </button>
      </dt>
      <dd>{props.entry.a}</dd>
    </div>
  );
};
