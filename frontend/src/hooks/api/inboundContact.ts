import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";

export type InboundContact = {
  id: number;
  relay_number: number;
  inbound_number: string;
  last_inbound_date: string;
  last_inbound_type: string;
  num_calls: number;
  num_calls_blocked: number;
  last_call_date: string | null;
  num_texts: number;
  num_texts_blocked: number;
  last_text_date: string | null;
  blocked: boolean;
};

export type InboundContactData = Array<InboundContact>;

export type InboundContactNumber = (
  inbound_number: string,
) => Promise<Response>;

export type UpdateForwardingToPhone = (
  enabled: boolean,
  id: number,
) => Promise<Response>;

export function useInboundContact(): SWRResponse<
  InboundContactData,
  unknown
> & {
  setForwardingState: UpdateForwardingToPhone;
} {
  const inboundContactNumber: SWRResponse<InboundContactData, unknown> =
    useApiV1("/inboundcontact/");

  const setForwardingState: UpdateForwardingToPhone = async (
    blocked: boolean,
    id: number,
  ) => {
    const response = await apiFetch(`/inboundcontact/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ blocked }),
    });
    inboundContactNumber.mutate();
    return response;
  };

  return {
    ...inboundContactNumber,
    setForwardingState: setForwardingState,
  };
}
