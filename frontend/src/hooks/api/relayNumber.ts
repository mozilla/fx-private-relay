import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";

export type RelayNumber = {
  id: number;
  number: string;
  location?: string;
  enabled: boolean;
};

export type RelayNumberData = Array<RelayNumber>;

export type PhoneNumberRegisterRelayNumberFn = (
  phoneNumber: string
) => Promise<Response>;

export type UpdateForwardingToPhone = (
  enabled: boolean,
  id: number
) => Promise<Response>;
/**
 * Get relay (masked) phone number records for the authenticated user with our API using [SWR](https://swr.vercel.app).
 */

export function useRelayNumber(): SWRResponse<RelayNumberData, unknown> & {
  registerRelayNumber: PhoneNumberRegisterRelayNumberFn;
  setForwardingState: UpdateForwardingToPhone;
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

type RelayNumberSuggestion = {
  friendly_name: string;
  iso_country: string;
  locality: string;
  phone_number: string;
  postal_code: string;
  region: string;
};

export type RelayNumberSuggestionsData = {
  real_num: string;
  same_area_options: Array<RelayNumberSuggestion>;
  same_prefix_options: Array<RelayNumberSuggestion>;
  other_areas_options: Array<RelayNumberSuggestion>;
};

type SearchBody = {
  area_code?: string;
  location?: string;
};

export type SearchFunction = (search: string) => Promise<Response | undefined>;

export function useRelayNumberSuggestions(): SWRResponse<
  RelayNumberSuggestionsData,
  unknown
> & { search: SearchFunction } {
  const relayNumberSuggestions: SWRResponse<
    RelayNumberSuggestionsData,
    unknown
  > = useApiV1("/relaynumber/suggestions/");

  /**
   * Search folr relay number suggestions
   */
  const search: SearchFunction = async (search: string) => {
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

    relayNumberSuggestions.mutate();

    return response;
  };

  return { ...relayNumberSuggestions, search };
}
