import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";

export type RelayNumber = {
  number: string;
  location?: string;
};

export type RelayNumberData = Array<RelayNumber>;

export type PhoneNumberRegisterRelayNumberFn = (
  phoneNumber: string
) => Promise<Response>;
/**
 * Get relay (masked) phone number records for the authenticated user with our API using [SWR](https://swr.vercel.app).
 */

export function useRelayNumber(): SWRResponse<RelayNumberData, unknown> & {
  registerRelayNumber: PhoneNumberRegisterRelayNumberFn;
} {
  const relayNumber: SWRResponse<RelayNumberData, unknown> =
    useApiV1("/relaynumber/");

  // TODO: Add post function to same API url
  /**
   * Register selected Relay number
   */
  const registerRelayNumber: PhoneNumberRegisterRelayNumberFn = async (
    phoneNumber
  ) => {
    // TODO: Validate number as E.164
    // https://blog.kevinchisholm.com/javascript/javascript-e164-phone-number-validation/
    const response = await apiFetch("/relaynumber/", {
      method: "POST",
      body: JSON.stringify({ number: phoneNumber }),
    });
    relayNumber.mutate();
    return response;
  };

  return {
    ...relayNumber,
    registerRelayNumber: registerRelayNumber,
  };
}
/**
 * Get an array of possible Relay numbers the user can register.
 */

export async function getRelayNumberSuggestions(): Promise<Response> {
  const response = await apiFetch("/relaynumber/suggestions/", {
    method: "GET",
  });
  return response;
}
