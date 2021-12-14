import useSWR, { Fetcher, SWRResponse } from "swr";

export const authenticatedFetch = async (
  path: string,
  init?: Parameters<typeof fetch>[1]
) => {
  // TODO: Implement proper authentication.
  //       Until that's done, authenticate by opening http://127.0.0.1:8000/admin/authtoken/tokenproxy/,
  //       copying the token you need, then running:
  //           localStorage.setItem("authToken", "<your token>")
  //       in the browser console with the React UI open.
  const authToken = localStorage.getItem("authToken");
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (typeof authToken === "string") {
    headers.set("Authorization", `Token ${authToken}`);
  }
  const options: Parameters<typeof fetch>[1] = {
    ...init,
    headers: headers,
    credentials: "include",
  };

  const url = `${process.env.NEXT_PUBLIC_API_ORIGIN}${path}`;
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

export const useApiV1 = <Data = unknown, Error = unknown>(
  route: string
): SWRResponse<Data, Error> => {
  const result = useSWR(route, fetcher, {
    revalidateOnFocus: false,
  }) as SWRResponse<Data, Error>;
  return result;
};
