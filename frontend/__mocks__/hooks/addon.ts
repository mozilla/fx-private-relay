import { AddonData, useAddonData } from "../../src/hooks/addon";

jest.mock("../../src/hooks/addon");

// We know that `jest.mock` has turned `useAddonData` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseAddonData = useAddonData as jest.MockedFunction<
  typeof useAddonData
>;

function getReturnValue(
  addonData?: Partial<AddonData>
): ReturnType<typeof useAddonData> {
  return {
    sendEvent: jest.fn(),
    present: false,
    isLoggedIn: false,
    localLabels: [],
    ...addonData,
  };
}

export const setMockAddonData = (addonData?: Partial<AddonData>) => {
  mockedUseAddonData.mockReturnValue(getReturnValue(addonData));
};

export const setMockAddonDataOnce = (addonData?: Partial<AddonData>) => {
  mockedUseAddonData.mockReturnValueOnce(getReturnValue(addonData));
};
