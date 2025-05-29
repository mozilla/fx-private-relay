import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockLocalizedModule } from "../../__mocks__/components/Localized";
import { mockConfigModule } from "../../__mocks__/configMock";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithBundle,
  getMockRuntimeDataWithoutPremium,
  getMockRuntimeDataWithPhones,
  setMockRuntimeData,
  setMockRuntimeDataOnce,
  getMockRuntimeDataWithMegabundle,
} from "../../__mocks__/hooks/api/runtimeData";
import { mockUseFxaFlowTrackerModule } from "../../__mocks__/hooks/fxaFlowTracker";
import { mockUseL10nModule } from "../../__mocks__/hooks/l10n";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

import Home from "./index.page";

jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");
jest.mock("../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);
jest.mock("../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../components/Localized.tsx", () => mockLocalizedModule);

setMockRuntimeData();
setMockProfileData(null);

describe("The landing page", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<Home />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    }, 10000);
  });

  describe("when Megabundle is NOT available", () => {
    beforeEach(() => {
      setMockRuntimeDataOnce({
        ...getMockRuntimeDataWithPhones(),
        MEGABUNDLE_PLANS: {
          country_code: "US",
          countries: ["US"],
          available_in_country: false,
          plan_country_lang_mapping: {},
        },
      });
    });

    it("shows the new feature comparison matrix", () => {
      render(<Home />);
      const comparisonMatrix = screen.getByRole("columnheader", {
        name: "l10n string: [plan-matrix-heading-plan-free], with vars: {}",
      });
      expect(comparisonMatrix).toBeInTheDocument();
    });

    it("shows the phone plan if phones is available in the user's country", () => {
      render(<Home />);
      const phoneColumn = screen.getByRole("columnheader", {
        name: "l10n string: [plan-matrix-heading-plan-phones], with vars: {}",
      });
      expect(phoneColumn).toBeInTheDocument();
    });
  });

  describe("when Megabundle IS available", () => {
    beforeEach(() => {
      setMockRuntimeDataOnce(getMockRuntimeDataWithMegabundle());
    });

    it("shows the megabundle banner", () => {
      render(<Home />);
      const heading = screen.getByText((content) =>
        content.startsWith(
          "l10n string: [megabundle-banner-header], with vars:",
        ),
      );
      expect(heading).toBeInTheDocument();
    });

    it("does not show the bundle banner", () => {
      render(<Home />);
      const bundleText = screen.queryByText(
        "[<Localized> with id [bundle-banner-heading] and vars: {}]",
      );
      expect(bundleText).not.toBeInTheDocument();
    });

    it("does not show the PlanMatrix grid", () => {
      render(<Home />);
      const matrixColumn = screen.queryByRole("columnheader", {
        name: /plan-matrix-heading-plan-free/,
      });
      expect(matrixColumn).not.toBeInTheDocument();
    });

    it("does show the PlanGrid content", () => {
      render(<Home />);
      expect(screen.getByTestId("plan-grid-megabundle")).toBeInTheDocument();
    });
  });
});
