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

  it("shows the free mask limit from runtimeData", () => {
    const runtimeDataWith5 = {
      ...getMockRuntimeDataWithBundle(),
      MAX_NUM_FREE_ALIASES: 5,
    };
    setMockRuntimeDataOnce(runtimeDataWith5);
    const { unmount } = render(<PlanMatrix runtimeData={runtimeDataWith5} />);

    // AvailabilityListing renders the number directly in the desktop table.
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.queryByText("50")).not.toBeInTheDocument();

    unmount();

    const runtimeDataWith50 = {
      ...getMockRuntimeDataWithBundle(),
      MAX_NUM_FREE_ALIASES: 50,
    };
    setMockRuntimeDataOnce(runtimeDataWith50);
    render(<PlanMatrix runtimeData={runtimeDataWith50} />);

    expect(screen.getAllByText("50").length).toBeGreaterThan(0);
    expect(screen.queryByText("5")).not.toBeInTheDocument();
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
