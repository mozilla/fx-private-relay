import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

export type UserData = {
  email: string;
};

export type UsersData = [UserData];

export function useUsers() {
  const users: SWRResponse<UsersData, unknown> = useApiV1("/users/");
  return users;
}
