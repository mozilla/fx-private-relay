import { SWRResponse } from "swr";
import { E164Number } from "../../functions/e164number";
import { apiFetch, FetchError, useApiV1 } from "./api";

export type RelayNumber = {
  id: number;
  number: E164Number;
  location?: string;
  country_code: string;
  enabled: boolean;
  remaining_texts: number;
  remaining_minutes: number;
  calls_forwarded: number;
  calls_blocked: number;
  texts_forwarded: number;
  texts_blocked: number;
  calls_and_texts_forwarded: number;
  calls_and_texts_blocked: number;
};

export type RelayNumberData = Array<RelayNumber>;

export type PhoneNumberRegisterRelayNumberFn = (
  phoneNumber: E164Number
) => Promise<Response>;

export type UpdateForwardingToPhone = (
  enabled: boolean,
  id: number
) => Promise<Response>;

export type UseRelayNumberOptions = Partial<{
  /**
   * Set to `true` to prevent requests to the /relaynumber/ API
   *
   * This is useful if e.g. you already know that the user does not have a phone
   * masking subscription.
   */
  disable?: boolean;
}>;

/**
 * Get relay (masked) phone number records for the authenticated user with our API using [SWR](https://swr.vercel.app).
 */
export function useRelayNumber(
  options: UseRelayNumberOptions = {}
): SWRResponse<RelayNumberData, unknown> & {
  registerRelayNumber: PhoneNumberRegisterRelayNumberFn;
  setForwardingState: UpdateForwardingToPhone;
} {
  const relayNumber: SWRResponse<RelayNumberData, unknown> = useApiV1(
    options.disable === true ? null : "/relaynumber/"
  );

  // TODO: Add post function to same API url
  /**
   * Register selected Relay number
   */
  const registerRelayNumber: PhoneNumberRegisterRelayNumberFn = async (
    phoneNumber
  ) => {
    // TODO: Validate number as E.164
    // See the [[isE164Number]] function.
    const response = await apiFetch("/relaynumber/", {
      method: "POST",
      body: JSON.stringify({ number: phoneNumber }),
    });
    relayNumber.mutate();
    return response;
  };
  /**
   * Set the forwarding state
   */
  const setForwardingState: UpdateForwardingToPhone = async (
    enabled: boolean,
    id: number
  ) => {
    const response = await apiFetch(`/relaynumber/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    relayNumber.mutate();
    return response;
  };

  return {
    ...relayNumber,
    registerRelayNumber: registerRelayNumber,
    setForwardingState: setForwardingState,
  };
}

export type RelayNumberSuggestionsData = {
  real_num: E164Number;
  same_area_options: Array<RelayNumberSuggestion>;
  same_prefix_options: Array<RelayNumberSuggestion>;
  other_areas_options: Array<RelayNumberSuggestion>;
  random_options: Array<RelayNumberSuggestion>;
};

export function useRelayNumberSuggestions(): SWRResponse<
  RelayNumberSuggestionsData,
  unknown
> {
  const relayNumberSuggestions: SWRResponse<
    RelayNumberSuggestionsData,
    unknown
  > = useApiV1("/relaynumber/suggestions/");

  return relayNumberSuggestions;
}

export type RelayNumberSuggestion = {
  friendly_name: string;
  iso_country: string;
  locality: string;
  phone_number: E164Number;
  postal_code: string;
  region: string;
};

/**
 * Search for relay number suggestions
 */
export const search = async (search: string) => {
  // return early if search is empty
  if (search.length === 0) return;

  // if search is a number, assume it is an area code
  // if search is not a number, assume it is a location
  const searchParameter = !isNaN(+search)
    ? `?area_code=${search}`
    : `?location=${search}`;

  // use api to search for relay number suggestions based on search body
  const response = await apiFetch(`/relaynumber/search/${searchParameter}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new FetchError(response);
  }

  const data: RelayNumberSuggestion[] = await response.json();

  return data;
};
