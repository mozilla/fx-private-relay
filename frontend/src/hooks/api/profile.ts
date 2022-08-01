import useSWR, { SWRConfig, SWRResponse } from "swr";
import { DateString } from "../../functions/parseDate";
import { apiFetch, authenticatedFetch, FetchError } from "./api";

export type ProfileData = {
  id: number;
  server_storage: boolean;
  has_premium: boolean;
  has_phone: boolean;
  subdomain: string | null;
  onboarding_state: number;
  avatar: string;
  date_subscribed: null | DateString;
  remove_level_one_email_trackers: boolean;
  next_email_try: DateString;
  bounce_status: [false, ""] | [true, "soft"] | [true, "hard"];
  api_token: string;
  emails_blocked: number;
  emails_forwarded: number;
  emails_replied: number;
  level_one_trackers_blocked: number;
};

export type ProfilesData = [ProfileData];

export type ProfileUpdateFn = (
  id: ProfileData["id"],
  data: Omit<Partial<ProfileData>, "subdomain">
) => Promise<Response>;
export type SetSubdomainFn = (
  subdomain: Exclude<ProfileData["subdomain"], null>
) => Promise<Response>;

/**
 * Fetch the user's profile data from our API using [SWR](https://swr.vercel.app).
 */
export function useProfiles(): SWRResponse<ProfilesData, unknown> & {
  update: ProfileUpdateFn;
  setSubdomain: SetSubdomainFn;
} {
  const profiles = useSWR("/profiles/", profileFetcher, {
    revalidateOnFocus: false,
    onErrorRetry: (
      error: unknown | FetchError,
      key,
      config: Parameters<typeof SWRConfig.default.onErrorRetry>[2],
      revalidate,
      revalidateOpts
    ) => {
      if (error instanceof FetchError && error.response.status === 403) {
        // When the user is not logged in, this API returns a 403.
        // If so, do not retry.
        return;
      }
      SWRConfig.default.onErrorRetry(
        error,
        key,
        config,
        revalidate,
        revalidateOpts
      );
    },
  }) as SWRResponse<ProfilesData, FetchError>;

  /**
   * Update a user's profile. Note that setting a subdomain currently requires
   * the use of `setSubdomain`, because that calls a special API endpoint that
   * will also hash the subdomain to prevent duplicate subdomains.
   */
  const update: ProfileUpdateFn = async (id, data) => {
    const response = await apiFetch(`/profiles/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    profiles.mutate();
    return response;
  };
  const setSubdomain: SetSubdomainFn = async (subdomain) => {
    const response = await authenticatedFetch("/accounts/profile/subdomain", {
      method: "POST",
      body: new URLSearchParams({ subdomain: subdomain }).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    profiles.mutate();
    return response;
  };

  return {
    ...profiles,
    update: update,
    setSubdomain: setSubdomain,
  };
}

/**
 * Instead of using the `fetcher` from `api.ts`, this fetcher is specific to the profiles API.
 * The reason that it's needed is that we have to tell the back-end to re-fetch data from
 * Firefox Accounts if the user was sent back here after trying to subscribe to Premium.
 */
const profileFetcher = async (
  url: string,
  requestInit: RequestInit
): Promise<ProfilesData> => {
  const isToldByFxaToRefresh =
    document.location.search.indexOf("fxa_refresh=1") !== -1;

  if (isToldByFxaToRefresh) {
    const refreshResponse = await authenticatedFetch(
      "/accounts/profile/refresh"
    );
    await refreshResponse.json();
  }

  const response = await apiFetch(url, requestInit);
  if (!response.ok) {
    throw new FetchError(response);
  }
  const data: ProfilesData = await response.json();
  return data;
};
