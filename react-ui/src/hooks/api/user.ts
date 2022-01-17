import { SWRResponse } from "swr";
import { useApiV1 } from "./api";

export type UserData = {
  email: string;
};

export type UsersData = [UserData];

export const useUsers = () => {
  const users: SWRResponse<UsersData, unknown> = useApiV1("/users/");
  return users;
};
