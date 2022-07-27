import { SWRResponse } from "swr";
import { DateString, parseDate } from "../../functions/parseDate";
import { apiFetch, useApiV1 } from "./api";

export type VerifiedPhone = {
  id: number;
  number: string;
  verification_code: string;
  verification_sent_date: DateString;
  verified: true;
  verified_date: DateString;
};

export type UnverifiedPhone = {
  id: number;
  number: string;
  verification_code: string;
  verification_sent_date: null | DateString;
  verified: false | undefined;
  verified_date: null;
};

export type RealPhoneData = Array<VerifiedPhone | UnverifiedPhone>;

export function isVerified(
  phone: UnverifiedPhone | VerifiedPhone
): phone is VerifiedPhone {
  if (phone.verified === undefined) {
    return false;
  }
  return phone.verified;
}

export function hasVerificationSentDates(
  phone: UnverifiedPhone | VerifiedPhone
): phone is VerifiedPhone {
  // Short circuit logic if there's no verification sent yet
  if (
    phone.verification_sent_date === undefined ||
    phone.verification_sent_date === null
  ) {
    return false;
  }

  const verificationSentDate = parseDate(
    phone.verification_sent_date
  ).getTime();
  const currentDateMinus5Mins = new Date().getTime() - 5 * 60 * 1000;

  if (verificationSentDate < currentDateMinus5Mins) {
    return false;
  }
  return true;
}

export type RealPhonesData = [RealPhoneData];

export type PhoneNumberRequestVerificationFn = (
  phoneNumber: string
) => Promise<Response>;

export type PhoneNumberSubmitVerificationFn = (
  id: number,
  obj: { number: string; verification_code: string }
) => Promise<Response>;

/**
 * Get real (true) phone number records for the authenticated user with our API using [SWR](https://swr.vercel.app).
 */
export function useRealPhonesData(): SWRResponse<RealPhoneData, unknown> & {
  requestPhoneVerification: PhoneNumberRequestVerificationFn;
  submitPhoneVerification: PhoneNumberSubmitVerificationFn;
} {
  const realphone: SWRResponse<RealPhoneData, unknown> =
    useApiV1("/realphone/");

  /**
   * Submit the one-time password given from the requestPhoneVerification function * to confirm/register a real phone number
   */
  const submitPhoneVerification: PhoneNumberSubmitVerificationFn = async (
    id,
    obj
  ) => {
    const response = await apiFetch(`/realphone/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(obj),
    });
    realphone.mutate();
    return response;
  };

  /**
   * Request a one-time password to validate a real phone number.
   */
  const requestPhoneVerification: PhoneNumberRequestVerificationFn = async (
    phoneNumber
  ) => {
    // TODO: Validate number as E.164
    // https://blog.kevinchisholm.com/javascript/javascript-e164-phone-number-validation/

    const response = await apiFetch("/realphone/", {
      method: "POST",
      body: JSON.stringify({ number: phoneNumber }),
    });
    realphone.mutate();
    return response;
  };

  return {
    ...realphone,
    requestPhoneVerification: requestPhoneVerification,
    submitPhoneVerification: submitPhoneVerification,
  };
}

export type RelayPhone = {
  number: string;
  location?: string;
};

export type RelayPhoneData = Array<RelayPhone>;

export type PhoneNumberRegisterRelayNumberFn = (
  phoneNumber: string
) => Promise<Response>;

/**
 * Get relay (masked) phone number records for the authenticated user with our API using [SWR](https://swr.vercel.app).
 */
export function useRelayNumber(): SWRResponse<RelayPhoneData, unknown> & {
  registerRelayNumber: PhoneNumberRegisterRelayNumberFn;
} {
  const relayNumber: SWRResponse<RelayPhoneData, unknown> =
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
