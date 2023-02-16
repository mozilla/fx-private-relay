import { ReactNode, useRef, useState } from "react";
import styles from "./FaqAccordion.module.scss";
import { PlusIcon } from "../Icons";
import { useL10n } from "../../hooks/l10n";

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

export const FaqAccordionLanding = () => {
  const l10n = useL10n();

  return (
    <FaqAccordionItem
      entries={[
        {
          q: l10n.getString("faq-question-availability-question"),
          a: l10n.getString("faq-question-landing-page-availability"),
          expandedFirst: true,
        },
        {
          q: l10n.getString("faq-question-what-is-question-2"),
          a: l10n.getString("faq-question-what-is-answer-2"),
        },
        {
          q: l10n.getString("faq-question-use-cases-question-2"),
          a: (
            <>
              <p>{l10n.getString("faq-question-use-cases-answer-part1-2")}</p>
              <p>{l10n.getString("faq-question-use-cases-answer-part2-2")}</p>
            </>
          ),
        },
        {
          q: l10n.getString("faq-question-browser-support-question"),
          a: l10n.getString("faq-question-browser-support-answer-2"),
        },
      ]}
    />
  );
};
