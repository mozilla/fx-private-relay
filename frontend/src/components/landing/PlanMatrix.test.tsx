import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "../../../__mocks__/modules/renderWithProviders";

import { setMockProfileData } from "../../../__mocks__/hooks/api/profile";
import {
  setMockRuntimeDataOnce,
  getMockRuntimeDataWithPhones,
  getMockRuntimeDataWithBundle,
  getMockRuntimeDataWithoutPremium,
} from "../../../__mocks__/hooks/api/runtimeData";

import { PlanMatrix } from "./PlanMatrix";

setMockProfileData(null);

describe("PlanMatrix", () => {
  it("renders the desktop table headers correctly", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithBundle());
    render(<PlanMatrix runtimeData={getMockRuntimeDataWithBundle()} />);

    expect(
      screen.getByRole("columnheader", {
        name: "l10n string: [plan-matrix-heading-plan-free], with vars: {}",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("columnheader", {
        name: "l10n string: [plan-matrix-heading-plan-premium], with vars: {}",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("columnheader", {
        name: "l10n string: [plan-matrix-heading-plan-phones], with vars: {}",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("columnheader", {
        name: /plan-matrix-heading-plan-bundle-2/,
      }),
    ).toBeInTheDocument();
  });

  it("shows waitlist link if premium is not available", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithoutPremium());
    render(<PlanMatrix runtimeData={getMockRuntimeDataWithoutPremium()} />);

    const waitlistLink = screen.getAllByRole("link", {
      name: "l10n string: [plan-matrix-join-waitlist], with vars: {}",
    });

    expect(waitlistLink.length).toBeGreaterThan(0);
  });

  it("renders phone plan headers", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithPhones());
    render(<PlanMatrix runtimeData={getMockRuntimeDataWithPhones()} />);

    expect(
      screen.getByRole("heading", {
        name: "l10n string: [plan-matrix-heading-plan-free], with vars: {}",
        level: 3,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "l10n string: [plan-matrix-heading-plan-premium], with vars: {}",
        level: 3,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "l10n string: [plan-matrix-heading-plan-phones], with vars: {}",
        level: 3,
      }),
    ).toBeInTheDocument();
  });
});
