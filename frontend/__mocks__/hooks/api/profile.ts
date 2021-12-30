import { jest } from "@jest/globals";
import { ProfileData, ProfileUpdateFn, useProfiles } from "../../../src/hooks/api/profile";

jest.mock("../../../src/hooks/api/profile");

// We know that `jest.mock` has turned `useProfiles` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseProfiles = useProfiles as jest.MockedFunction<
  typeof useProfiles
>;

type MockData = Partial<ProfileData>;
type Callbacks = {
  updater?: ProfileUpdateFn,
};
function getReturnValue(profileData?: MockData, callbacks?: Callbacks): ReturnType<typeof useProfiles>  {
  return {
    isValidating: false,
    mutate: jest.fn(),
    update: callbacks?.updater ?? jest.fn(),
    data: [
      {
        has_premium: false,
        id: 0,
        server_storage: true,
        subdomain: null,
        onboarding_state: 3,
        avatar: "",
        api_token: "",
        ...profileData,
      },
    ],
  };
}

export const setMockProfileData = (profileData?: MockData, callbacks?: Callbacks) => {
  mockedUseProfiles.mockReturnValue(getReturnValue(profileData, callbacks));
};

export const setMockProfileDataOnce = (profileData?: MockData, callbacks?: Callbacks) => {
  mockedUseProfiles.mockReturnValueOnce(getReturnValue(profileData, callbacks));
};
