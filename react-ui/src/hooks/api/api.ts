import useSWR, { Fetcher, SWRResponse } from "swr";

const fetcher: Fetcher<unknown> = async (...args) => {
  // TODO: Implement proper authentication.
  //       Until that's done, authenticate by opening http://127.0.0.1:8000/admin/authtoken/tokenproxy/,
  //       copying the token you need, then running:
  //           localStorage.setItem("authToken", "<your token>")
  //       in the browser console with the React UI open.
  const authToken = localStorage.getItem("authToken");
  const headers = new Headers(args[1]?.options?.headers ?? undefined);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (typeof authToken === "string") {
    headers.set("Authorization", `Token ${authToken}`);
  }
  const options: Parameters<typeof fetch>[1] = {
    ...args[1],
    headers: headers,
    credentials: "include",
  };
  const response = await fetch(args, options);
  const data: unknown = await response.json();
  return data;
};

export const useApiV1 = <Data = unknown, Error = unknown>(
  route: string
): SWRResponse<Data, Error> => {
  const url = `${process.env.NEXT_PUBLIC_API_ORIGIN}/api/v1${route}`;
  const result = useSWR(url, fetcher, {
    revalidateOnFocus: false,
  }) as SWRResponse<Data, Error>;
  return result;
};
