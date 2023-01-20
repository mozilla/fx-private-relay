import { SWRResponse, SWRConfig } from "swr";
import { FetchError, useApiV1 } from "./api";

export type UserData = {
  email: string;
};

export type UsersData = [UserData];

/**
 * Fetch the user's user data (primarily their email address) from our API using [SWR](https://swr.vercel.app).
 */
export function useUsers() {
  const users: SWRResponse<UsersData, unknown> = useApiV1("/users/", {
    onErrorRetry: (
      error: unknown | FetchError,
      key,
      config,
      revalidate,
      revalidateOpts
    ) => {
      if (error instanceof FetchError && error.response.status === 401) {
        // When the user is not logged in, this API returns a 401.
        // If so, do not retry.
        return;
      }
      SWRConfig.defaultValue.onErrorRetry(
        error,
        key,
        config,
        revalidate,
        revalidateOpts
      );
    },
  });
  return users;
}
