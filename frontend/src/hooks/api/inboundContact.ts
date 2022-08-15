import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";

export type InboundContact = {
  id: number;
  relay_number: number;
  inbound_number: string;
  last_inbound_date: string;
  num_calls: number;
  num_calls_blocked: number;
  num_texts: number;
  num_texts_blocked: number;
  blocked: boolean;
};

export type InboundContactData = Array<InboundContact>;

export type InboundContactNumber = (
  inbound_number: string
) => Promise<Response>;
/**

/**
 * Get relay (masked) phone number records for the authenticated user with our API using [SWR](https://swr.vercel.app).
 */

export function useInboundContact(): SWRResponse<InboundContactData, unknown> {
  const inboundContactNumber: SWRResponse<InboundContactData, unknown> =
    useApiV1("/inboundcontact/");

  // TODO: Add post function to same API url
  /**
   * Register selected Relay number
   */

  //    const findInboundContactNumber: InboundContactNumber = async (
  //     phoneNumber
  //   ) => {
  //     // TODO: Validate number as E.164
  //     // https://blog.kevinchisholm.com/javascript/javascript-e164-phone-number-validation/
  //     const response = await apiFetch("/inboundcontact/", {
  //       method: "POST",
  //       body: JSON.stringify({ number: phoneNumber }),
  //     });
  //     inboundContactNumber.mutate();
  //     return response;
  //   };

  return {
    ...inboundContactNumber,
    // getInboundContactNumber: findInboundContactNumber,
  };
}
