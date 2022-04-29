import { useMinViewportWidth } from "../../src/hooks/mediaQuery";

jest.mock("../../src/hooks/mediaQuery");

// We know that `jest.mock` has turned `useMinViewportWidth` into a mock function,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseMinViewportWidth = useMinViewportWidth as jest.MockedFunction<
  typeof useMinViewportWidth
>;

export function setMockMinViewportWidth(matches?: boolean) {
  mockedUseMinViewportWidth.mockReturnValue(matches ?? true);
}

export function setMockMinViewportWidthOnce(matches?: boolean) {
  mockedUseMinViewportWidth.mockReturnValueOnce(matches ?? true);
}
