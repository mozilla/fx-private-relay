import { SWRResponse } from "swr";
import useSWRMutation, { SWRMutationHook } from "swr/mutation";
import { E164Number } from "../../functions/e164number";
import { apiFetch, useApiV1 } from "./api";
import { DateString } from "../../functions/parseDate";

export type InboundMessage = {
  from: E164Number;
  to: E164Number;
  date_sent: DateString;
  body: string;
};
export type OutboundMessage = {
  from: E164Number;
  to: E164Number;
  date_sent: DateString;
  body: string;
};

export type MessagesData = {
  inbound_messages: InboundMessage[];
  outbound_messages: OutboundMessage[];
};

export type Options = Partial<{
  filter: {
    with?: string;
    direction?: "inbound" | "outbound";
  };
}>;

export function useMessages(
  options: Options = {}
): SWRResponse<MessagesData> & { sendMessage: SendMessage } {
  const queryParamers = new URLSearchParams();
  if (typeof options.filter?.direction === "string") {
    queryParamers.set("direction", options.filter.direction);
  }
  if (typeof options.filter?.with === "string") {
    queryParamers.set("with", options.filter.with);
  }
  const searchParams = "?" + queryParamers.toString();
  const messages: SWRResponse<MessagesData> = useApiV1(
    "/messages/" + (searchParams.length > 1 ? searchParams : "")
  );

  const sendMessage = async (message: string, receiver: E164Number) => {
    const body = {
      body: message,
      destination: receiver,
    };
    const response = await apiFetch("/message/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    messages.mutate();
    return response;
  };

  return {
    ...messages,
    sendMessage: sendMessage,
  };
}

export type SendMessage = (
  message: string,
  receiver: E164Number
) => Promise<Response>;
