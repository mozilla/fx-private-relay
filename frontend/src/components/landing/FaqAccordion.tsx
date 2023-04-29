import { ReactNode, useRef, useState } from "react";
import styles from "./FaqAccordion.module.scss";
import { PlusIcon } from "../Icons";

export type Entry = {
  q: string;
  a: ReactNode;
  expanded?: boolean;
};

export type Props = {
  entries: Entry[];
};

/**
 * Highlight a selection of questions from the FAQ, allowing people to expand them to see the answers.
 */
export const FaqAccordionItem = (props: Props) => {
  const [entries, setEntries] = useState(props.entries);

  function handleToggle(q: string) {
    setEntries(entries.map((entry) => ({
      q: entry.q,
      a: entry.a,
      expanded: entry.q === q && !entry.expanded,
    })));
  }

  return <dl>{
    entries.map((entry) => (
      <QAndA key={entry.q} entry={entry} onToggle={handleToggle} />
    ))
  }</dl>;
};

const QAndA = (props: { entry: Entry, onToggle: (q: string) => void }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  function setToggleView() {
    const isExpanded = styles["is-expanded"];
    const isCollapsed = styles["is-collapsed"];

    return props.entry.expanded ? isExpanded : isCollapsed;
  }

  return (
    <div className={`${styles.entry} ${setToggleView()}`}>
      <dt>
        <button
          onClick={() => props.onToggle(props.entry.q)}
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
