import { jest } from "@jest/globals";
import { ProfileData, useProfiles } from "../../../src/hooks/api/profile";

jest.mock("../../../src/hooks/api/profile");

// We know that `jest.mock` has turned `useProfiles` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseProfiles = useProfiles as jest.MockedFunction<
  typeof useProfiles
>;

export const setMockProfileData = (profileData: Partial<ProfileData>) => {
  const returnValue: ReturnType<typeof useProfiles> = {
    isValidating: false,
    mutate: jest.fn(),
    update: jest.fn(),
    data: [
      {
        has_premium: false,
        id: 0,
        server_storage: true,
        subdomain: null,
        ...profileData,
      },
    ],
  };

  mockedUseProfiles.mockReturnValue(returnValue);
};
