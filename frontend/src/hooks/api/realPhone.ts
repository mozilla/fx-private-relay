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
  verification_sent_date: DateString;
  verified: false | undefined;
  verified_date: null;
};

export type RealPhone = VerifiedPhone | UnverifiedPhone;

export type RealPhoneData = Array<RealPhone>;

export function isVerified(phone: RealPhone): phone is VerifiedPhone {
  if (phone.verified === undefined) {
    return false;
  }
  return phone.verified;
}

export function isNotVerified(phone: RealPhone): phone is UnverifiedPhone {
  return !isVerified(phone);
}

export function hasPendingVerification(
  phone: RealPhone
): phone is UnverifiedPhone {
  // Short circuit logic if there's no verification sent yet,
  // or if the phone number has already been verified:
  if (
    phone.verification_sent_date === undefined ||
    phone.verification_sent_date === null ||
    phone.verified === true
  ) {
    return false;
  }

  const verificationSentDate = parseDate(
    phone.verification_sent_date
  ).getTime();
  const currentDateMinus5Mins = new Date().getTime() - 5 * 60 * 1000;

  return verificationSentDate >= currentDateMinus5Mins;
}

export type RealPhonesData = [RealPhoneData];

export type PhoneNumberRequestVerificationFn = (
  phoneNumber: string
) => Promise<Response>;

export type RealPhoneVerification = Pick<
  VerifiedPhone,
  "number" | "verification_code"
>;
export type PhoneNumberSubmitVerificationFn = (
  id: number,
  obj: RealPhoneVerification
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
