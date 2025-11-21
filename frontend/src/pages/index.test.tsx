import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithPhones,
  setMockRuntimeData,
  getMockRuntimeDataWithMegabundle,
} from "../../__mocks__/hooks/api/runtimeData";

import Home from "./index.page";

jest.mock("../functions/getPlan", () =>
  jest.requireActual("../../__mocks__/functions/getPlan"),
);

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
      expect(results!).toHaveNoViolations();
    }, 10000);
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

    it("shows the old feature comparison matrix", () => {
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
      setMockRuntimeData(getMockRuntimeDataWithMegabundle());
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
