import useSWR, { Fetcher, SWRResponse } from "swr";
import { getRuntimeConfig } from "../../config";
import { getCsrfToken } from "../../functions/cookies";

export const authenticatedFetch = async (
  path: string,
  init?: Parameters<typeof fetch>[1]
) => {
  let authToken;
  if (process.env.NODE_ENV === "development") {
    // Note: If running on a separate (dev) server, logging in doesn't work.
    //       As a workaround, you can authenticate by opening http://127.0.0.1:8000/admin/authtoken/tokenproxy/,
    //       copying the token you need, then running:
    //           localStorage.setItem("authToken", "<your token>")
    //       in the browser console with the React UI open.
    authToken = localStorage.getItem("authToken");
  }
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (typeof authToken === "string") {
    headers.set("Authorization", `Token ${authToken}`);
  }
  const csrfToken = getCsrfToken();
  if (typeof csrfToken === "string") {
    headers.set("X-CSRFToken", csrfToken);
  }
  const options: Parameters<typeof fetch>[1] = {
    ...init,
    headers: headers,
    credentials: "include",
  };

  const url = `${getRuntimeConfig().backendOrigin}${path}`;
  const response = await fetch(url, options);
  return response;
};

export const apiFetch = async (
  route: string,
  init?: Parameters<typeof fetch>[1]
) => {
  const path = `/api/v1${route}`;
  return authenticatedFetch(path, init);
};

const fetcher: Fetcher<unknown> = async (...args) => {
  const response = await apiFetch(args[0], args[1]);
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  const data: unknown = await response.json();
  return data;
};

export function useApiV1<Data = unknown, Error = unknown>(
  route: string
): SWRResponse<Data, Error> {
  // TODO: Also use the sessionId cookie in the key,
  //       to ensure no data is cached from different users?
  //       (This is currently enforced by doing a full page refresh when logging out.)
  const result = useSWR(route, fetcher, {
    revalidateOnFocus: false,
  }) as SWRResponse<Data, Error>;
  return result;
}
