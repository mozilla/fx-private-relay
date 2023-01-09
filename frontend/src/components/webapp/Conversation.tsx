import styles from "./Conversation.module.scss";
import { E164Number } from "../../functions/e164number";
import { Conversations } from "../../functions/messagesToConversations";
import { renderDatetime } from "../../functions/renderDate";
import { useL10n } from "../../hooks/l10n";
import { ChevronLeftIcon } from "../Icons";

export type Props = {
  conversation: Conversations[keyof Conversations];
  partner: E164Number;
  onClose: () => void;
};

export const Conversation = (props: Props) => {
  const l10n = useL10n();

  return (
    <>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <button
            onClick={() => props.onClose()}
            className={styles["back-button"]}
          >
            <ChevronLeftIcon
              alt={l10n.getString("messages-conversation-back")}
            />
          </button>
          <h1 className={styles["conversation-partner"]}>{props.partner}</h1>
        </header>
        <div className={styles.messages}>
          {props.conversation.map((message, index) => {
            return (
              <p
                key={`${props.partner}_${index}`}
                className={`${styles.message} ${
                  message.from === props.partner
                    ? styles.inbound
                    : styles.outbound
                }`}
              >
                <span className={styles.body}>{message.body}</span>
                <time dateTime={message.date_sent}>
                  {renderDatetime(message.date_sent, l10n)}
                </time>
              </p>
            );
          })}
        </div>
      </div>
    </>
  );
};
