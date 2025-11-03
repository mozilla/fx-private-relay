import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import "./__mocks__/components/landingImages.mocks";

jest.mock("./src/components/Image", () => ({
  __esModule: true,
  default: require("./__mocks__/components/ImageMock").default,
}));
expect.extend(toHaveNoViolations);
