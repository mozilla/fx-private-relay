import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./FaqAccordion.module.scss";
import { PlusIcon } from "../Icons";

export type Entry = {
  q: string;
  a: ReactNode;
};

export type Props = {
  entries: Entry[];
  autoFocus?: boolean;
  defaultExpandedIndex?: number;
};

/**
 * Highlight a selection of questions from the FAQ, allowing people to expand them to see the answers.
 */
export const FaqAccordionItem = (props: Props) => {
  const [expandedIndex, setExpandedIndex] = useState(
    props.defaultExpandedIndex ?? 0,
  );
  const { autoFocus } = props;

  return (
    <dl>
      {props.entries.map((entry: Entry, index) => (
        <QAndA
          key={entry.q}
          entry={entry}
          isExpanded={expandedIndex === index}
          onToggle={() => setExpandedIndex(index)}
          autoFocus={autoFocus && index === expandedIndex}
        />
      ))}
    </dl>
  );
};

const QAndA = (props: {
  entry: Entry;
  isExpanded: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (props.isExpanded && props.autoFocus) {
      buttonRef.current?.focus();
    }
  }, [props.isExpanded, props.autoFocus]);

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
