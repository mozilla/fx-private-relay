import { SWRResponse } from "swr";
import { E164Number } from "../../functions/e164number";
import { useApiV1 } from "./api";
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

export function useMessages(options: Options = {}): SWRResponse<MessagesData> {
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

  return messages;
}
