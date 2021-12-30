import { jest } from "@jest/globals";
import { UserData, useUsers } from "../../../src/hooks/api/user";

jest.mock("../../../src/hooks/api/user");

// We know that `jest.mock` has turned `useUsers` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseUsers = useUsers as jest.MockedFunction<
  typeof useUsers
>;

function getReturnValue(userData?: Partial<UserData>): ReturnType<typeof useUsers>  {
  return {
    isValidating: false,
    mutate: jest.fn(),
    data: [
      {
        email: "arbitrary@example.com",
        ...userData,
      },
    ],
  };
}

export const setMockUserData = (userData?: Partial<UserData>) => {
  mockedUseUsers.mockReturnValue(getReturnValue(userData));
};

export const setMockUserDataOnce = (userData?: Partial<UserData>) => {
  mockedUseUsers.mockReturnValueOnce(getReturnValue(userData));
};
