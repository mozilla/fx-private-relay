import {
  LocalLabel,
  LocalLabelHook,
  NotEnabled,
  SetLocalLabel,
  useLocalLabels,
} from "../../src/hooks/localLabels";

jest.mock("../../src/hooks/localLabels");

// We know that `jest.mock` has turned `useAddonData` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseLocalLabels = useLocalLabels as jest.MockedFunction<
  typeof useLocalLabels
>;

export function getReturnValueWhenEnabled(
  localLabels: Array<Partial<LocalLabel>> = [],
  callback: SetLocalLabel = jest.fn()
): LocalLabelHook {
  return [
    localLabels.map((localLabel, i) => ({
      description: "Arbitrary description",
      generated_for: "https://example.com",
      id: i,
      type: "random",
      ...localLabel,
    })),
    callback,
  ];
}
export function getReturnValueWhenDisabled(
  callback: SetLocalLabel = jest.fn()
): NotEnabled {
  return [null, callback];
}

export const setMockLocalLabels = (
  returnValue: LocalLabelHook | NotEnabled = getReturnValueWhenDisabled()
) => {
  mockedUseLocalLabels.mockReturnValue(returnValue);
};

export const setMockLocalLabelsOnce = (
  returnValue: LocalLabelHook | NotEnabled = getReturnValueWhenDisabled()
) => {
  mockedUseLocalLabels.mockReturnValueOnce(returnValue);
};
