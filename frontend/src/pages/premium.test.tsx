import { act, render } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockConfigModule } from "../../__mocks__/configMock";
import { mockUseFxaFlowTrackerModule } from "../../__mocks__/hooks/fxaFlowTracker";
import { mockFluentReact } from "../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

import PremiumPromo from "./premium.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");
jest.mock("../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);

describe("The promotional page about Relay Premium", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<PremiumPromo />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    });
  });
});
