import { SWRResponse } from "swr";
import { DateString } from "../../functions/parseDate";
import { apiFetch, useApiV1 } from "./api";

export type RealPhoneData = {
  id: number;
  number: string;
  verification_code: string;
  verification_sent_date: null | DateString;
  verified: boolean;
  verified_date: null | DateString;
};

export type RealPhonesData = [RealPhoneData];

export type RealPhoneUpdateFn = (
  id: RealPhoneData["id"],
  data: Omit<Partial<RealPhoneData>, "subdomain">
) => Promise<Response>;

export type PhoneNumberRequestVerificationFn = (
  // id: RealPhoneData["id"],
  // data: Partial<RealPhoneData>
  phoneNumber: string
) => Promise<Response>;

export type PhoneNumberSubmitVerificationFn = (
  id: RealPhoneData["id"],
  data: Partial<RealPhoneData>
) => Promise<Response>;

/**
 * Get real phone number records for the authenticated user with our API using [SWR](https://swr.vercel.app).
 */
export function useRealPhones(): {
  requestPhoneVerification: PhoneNumberRequestVerificationFn;
  submitPhoneVerification: PhoneNumberSubmitVerificationFn;
  // setSubdomain: SetSubdomainFn;
} {
  const realphone: SWRResponse<RealPhoneData[], unknown> =
    useApiV1("/realphone/");
  // const realphone = useSWR("/realphone/", profileFetcher, {
  //   revalidateOnFocus: false,
  //   onErrorRetry: (
  //     error: unknown | FetchError,
  //     key,
  //     config: Parameters<typeof SWRConfig.default.onErrorRetry>[2],
  //     revalidate,
  //     revalidateOpts
  //   ) => {
  //     if (error instanceof FetchError && error.response.status === 403) {
  //       // When the user is not logged in, this API returns a 403.
  //       // If so, do not retry.
  //       return;
  //     }
  //     SWRConfig.default.onErrorRetry(
  //       error,
  //       key,
  //       config,
  //       revalidate,
  //       revalidateOpts
  //     );
  //   },
  // }) as SWRResponse<RealPhonesData, FetchError>;

  /**
   * Submit the one-time password given from the requestPhoneVerification function * to confirm/register a real phone number
   */
  const submitPhoneVerification: PhoneNumberSubmitVerificationFn = async (
    id,
    data
  ) => {
    const response = await apiFetch(`/realphone/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    realphone.mutate();
    return response;
  };
  // const setSubdomain: SetSubdomainFn = async (subdomain) => {
  //   const response = await authenticatedFetch("/accounts/profile/subdomain", {
  //     method: "POST",
  //     body: new URLSearchParams({ subdomain: subdomain }).toString(),
  //     headers: {
  //       "Content-Type": "application/x-www-form-urlencoded",
  //     },
  //   });
  //   realphone.mutate();
  //   return response;
  // };

  return {
    ...realphone,
    requestPhoneVerification: requestPhoneVerification,
    submitPhoneVerification: submitPhoneVerification,
  };
}

/**
 * Instead of using the `fetcher` from `api.ts`, this fetcher is specific to the profiles API.
 * The reason that it's needed is that we have to tell the back-end to re-fetch data from
 * Firefox Accounts if the user was sent back here after trying to subscribe to Premium.
 */
// const profileFetcher = async (
//   url: string,
//   requestInit: RequestInit
// ): Promise<RealPhonesData> => {
//   const isToldByFxaToRefresh =
//     document.location.search.indexOf("fxa_refresh=1") !== -1;

//   if (isToldByFxaToRefresh) {
//     const refreshResponse = await authenticatedFetch(
//       "/accounts/profile/refresh"
//     );
//     await refreshResponse.json();
//   }

//   const response = await apiFetch(url, requestInit);
//   if (!response.ok) {
//     throw new FetchError(response);
//   }
//   const data: RealPhonesData = await response.json();
//   return data;
// };
