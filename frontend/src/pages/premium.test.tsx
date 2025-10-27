import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockLocalizedModule } from "../../__mocks__/components/Localized";
import { mockConfigModule } from "../../__mocks__/configMock";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithMegabundle,
  getMockRuntimeDataWithBundle,
  getMockRuntimeDataWithoutPremium,
  getMockRuntimeDataWithPhones,
  setMockRuntimeData,
} from "../../__mocks__/hooks/api/runtimeData";
import { mockUseFxaFlowTrackerModule } from "../../__mocks__/hooks/fxaFlowTracker";
import { mockUseL10nModule } from "../../__mocks__/hooks/l10n";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");
jest.mock("../hooks/gaEvent.ts");
jest.mock("../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);
jest.mock("../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../components/Localized.tsx", () => mockLocalizedModule);

jest.mock("../functions/getPlan", () =>
  jest.requireActual("../../__mocks__/functions/getPlan"),
);

import PremiumPromo from "./premium.page";

setMockRuntimeData();
setMockProfileData(null);

describe("The promotional page about Relay Premium", () => {
  it("passes axe accessibility testing", async () => {
    setMockRuntimeData(getMockRuntimeDataWithBundle());
    const { baseElement } = render(<PremiumPromo />);
    const results = await act(() => axe(baseElement));
    expect(results).toHaveNoViolations();
  }, 10000);

  describe("when Megabundle IS available", () => {
    beforeEach(() => {
      setMockRuntimeData(getMockRuntimeDataWithMegabundle());
    });

    it("does not show the PlanMatrix grid", () => {
      render(<PremiumPromo />);
      const matrixColumn = screen.queryByRole("columnheader", {
        name: /plan-matrix-heading-plan-free/,
      });
      expect(matrixColumn).not.toBeInTheDocument();
    });

    it("shows the PlanGrid content", () => {
      render(<PremiumPromo />);
      expect(screen.getByTestId("plan-grid-megabundle")).toBeInTheDocument();
    });
  });

  describe("when Megabundle is NOT available", () => {
    beforeEach(() => {
      setMockRuntimeData({
        ...getMockRuntimeDataWithPhones(),
        MEGABUNDLE_PLANS: {
          country_code: "US",
          countries: ["US"],
          available_in_country: false,
          plan_country_lang_mapping: {},
        },
      });
    });

    it("shows the bundle banner", () => {
      render(<PremiumPromo />);
      const bundleColumn = screen.getByRole("columnheader", {
        name: "l10n string: [plan-matrix-heading-plan-bundle-2], with vars: {}",
      });
      expect(bundleColumn).toBeInTheDocument();
    });

    it("shows the PlanMatrix section", () => {
      render(<PremiumPromo />);
      const freeColumn = screen.getByRole("columnheader", {
        name: "l10n string: [plan-matrix-heading-plan-free], with vars: {}",
      });
      expect(freeColumn).toBeInTheDocument();
    });
  });

  it("shows a waitlist link when premium is not available", () => {
    setMockRuntimeData(getMockRuntimeDataWithoutPremium());
    render(<PremiumPromo />);
    const waitlistLink = screen.getByRole("link", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });
    expect(waitlistLink).toHaveAttribute("href", "/premium/waitlist");
  });
});
