import {
  InboundMessage,
  MessagesData,
  OutboundMessage,
} from "../hooks/api/messages";
import { E164Number } from "./e164number";
import { parseDate } from "./parseDate";

export type Conversations = Record<
  E164Number,
  Array<InboundMessage | OutboundMessage>
>;

export function messagesToConverations(
  messagesData: MessagesData
): Conversations {
  const inboundConversations = messagesData.inbound_messages.reduce(
    (conversationsAcc, inboundMessage) => {
      const conversation = conversationsAcc[inboundMessage.from] ?? [];
      conversation.push(inboundMessage);
      conversationsAcc[inboundMessage.from] = conversation;
      return conversationsAcc;
    },
    {} as Conversations
  );

  const conversations = messagesData.outbound_messages.reduce(
    (conversationsAcc, outboundMessage) => {
      const conversation = conversationsAcc[outboundMessage.to] ?? [];
      conversation.push(outboundMessage);
      conversation.sort(sortMessagesByDateAsc);
      conversationsAcc[outboundMessage.to] = conversation;
      return conversationsAcc;
    },
    inboundConversations
  );

  return conversations;
}

function sortMessagesByDateAsc(
  messageA: InboundMessage | OutboundMessage,
  messageB: InboundMessage | OutboundMessage
): number {
  const dateA = parseDate(messageA.date_sent);
  const dateB = parseDate(messageB.date_sent);
  return dateA.getTime() - dateB.getTime();
}
