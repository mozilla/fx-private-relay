import styles from "./Text.module.scss";
import { RelayNumber } from "../../hooks/api/relayNumber";
import { MessagesData } from "../../hooks/api/messages";
import { Item, ListProps, ListState, useListState } from "react-stately";
import { Key, useRef, useState } from "react";
import {
  AriaListBoxOptions,
  mergeProps,
  useFocusRing,
  useListBox,
  useOption,
} from "react-aria";
import { Node } from "@react-types/shared";
import { useL10n } from "../../hooks/l10n";
import { messagesToConverations } from "../../functions/messagesToConversations";
import { formatPhone } from "../../functions/formatPhone";
import { renderDatetime } from "../../functions/renderDate";
import { E164Number } from "../../functions/e164number";
import { Conversation } from "./Conversation";

export type Props = {
  relayNumber: RelayNumber;
  messages: MessagesData;
};

export const Text = (props: Props) => {
  const l10n = useL10n();
  const [currentConversation, setCurrentConversation] =
    useState<E164Number | null>(null);

  const conversations = messagesToConverations(props.messages);

  if (typeof currentConversation === "string") {
    return (
      <div className={styles.wrapper}>
        <Conversation
          conversation={conversations[currentConversation]}
          partner={currentConversation}
          onClose={() => setCurrentConversation(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {currentConversation}
      <ConversationList
        label={l10n.getString("messages-list-heading")}
        selectionMode="single"
        onSelectionChange={(selectedConversations) => {
          if (selectedConversations === "all") {
            return;
          }
          selectedConversations.forEach((selectedConversation) =>
            setCurrentConversation(selectedConversation as E164Number)
          );
        }}
      >
        {Object.entries(conversations).map(
          ([conversationPartner, conversation]) => (
            <Item key={conversationPartner}>
              <div className={styles["conversation-entry"]}>
                <dl>
                  <div className={styles.partner}>
                    <dt>
                      {l10n.getString(
                        "messages-list-conversation-partner-label"
                      )}
                    </dt>
                    <dd>{formatPhone(conversationPartner)}</dd>
                  </div>
                  <div className={styles.datetime}>
                    <dt>
                      {l10n.getString("messages-list-conversation-date-label")}
                    </dt>
                    <dd>
                      <time
                        dateTime={
                          conversation[conversation.length - 1].date_sent
                        }
                      >
                        {renderDatetime(
                          conversation[conversation.length - 1].date_sent,
                          l10n
                        )}
                      </time>
                    </dd>
                  </div>
                </dl>
              </div>
            </Item>
          )
        )}
      </ConversationList>
    </div>
  );
};

const ConversationList = (
  props: ListProps<object> & AriaListBoxOptions<unknown>
) => {
  const state = useListState(props);

  const listRef = useRef<HTMLOListElement>(null);
  const { listBoxProps, labelProps } = useListBox(props, state, listRef);

  return (
    <>
      <div {...labelProps} className={styles["conversation-list-heading"]}>
        {props.label}
      </div>
      <ol {...listBoxProps} ref={listRef}>
        {Array.from(state.collection).map((item) => (
          <ConversationEntry key={item.key} item={item} state={state} />
        ))}
      </ol>
    </>
  );
};

const ConversationEntry = (props: {
  item: Node<object>;
  state: ListState<object>;
}) => {
  const entryRef = useRef<HTMLLIElement>(null);
  const { optionProps } = useOption(
    { key: props.item.key },
    props.state,
    entryRef
  );

  const { focusProps } = useFocusRing();

  return (
    <li {...mergeProps(optionProps, focusProps)} ref={entryRef}>
      {props.item.rendered}
    </li>
  );
};
