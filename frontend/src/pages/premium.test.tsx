import { act, render } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockLocalizedModule } from "../../__mocks__/components/Localized";
import { mockConfigModule } from "../../__mocks__/configMock";
import { mockUseFxaFlowTrackerModule } from "../../__mocks__/hooks/fxaFlowTracker";
import { mockUseL10nModule } from "../../__mocks__/hooks/l10n";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

import PremiumPromo from "./premium.page";

jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");
jest.mock("../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);
jest.mock("../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../components/Localized.tsx", () => mockLocalizedModule);

describe("The promotional page about Relay Premium", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<PremiumPromo />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s
  });
});
