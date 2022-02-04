import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

export type UserData = {
  email: string;
};

export type UsersData = [UserData];

/**
 * Fetch the user's user data (primarily their email address) from our API using [SWR](https://swr.vercel.app).
 */
export function useUsers() {
  const users: SWRResponse<UsersData, unknown> = useApiV1("/users/");
  return users;
}
