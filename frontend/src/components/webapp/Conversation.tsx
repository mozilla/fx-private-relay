import styles from "./Conversation.module.scss";
import { E164Number } from "../../functions/e164number";
import { Conversations } from "../../functions/messagesToConversations";
import { renderDatetime } from "../../functions/renderDate";
import { useL10n } from "../../hooks/l10n";
import { CheckIcon, ChevronLeftIcon } from "../Icons";
import { FormEventHandler, useEffect, useRef, useState } from "react";
import { useMessages } from "../../hooks/api/messages";
import { Button } from "../Button";

export type Props = {
  conversation: Conversations[keyof Conversations];
  partner: E164Number;
  onClose: () => void;
};

export const Conversation = (props: Props) => {
  const l10n = useL10n();
  const messagesApi = useMessages();
  const [newMessage, setNewMessage] = useState("");
  const latestMessageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // Scroll to the newest message whenever a message gets added:
    latestMessageRef.current?.scrollIntoView();
  }, [props.conversation.length]);

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    await messagesApi.sendMessage(newMessage, props.partner);
    setNewMessage("");
  };

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
        <div className={styles["messages-wrapper"]}>
          <div className={styles.messages}>
            {props.conversation.map((message, index) => {
              return (
                <p
                  key={`${props.partner}_${index}`}
                  ref={
                    index === props.conversation.length - 1
                      ? latestMessageRef
                      : undefined
                  }
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
        <form onSubmit={onSubmit} className={styles.compose}>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            type="text"
            name="newMessage"
            id="newMessage"
          />
          <Button type="submit">
            <CheckIcon
              alt={l10n.getString("messages-conversation-message-send")}
            />
          </Button>
        </form>
      </div>
    </>
  );
};
