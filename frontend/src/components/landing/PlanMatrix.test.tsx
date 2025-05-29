import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import { mockLocalizedModule } from "../../../__mocks__/components/Localized";
import { mockConfigModule } from "../../../__mocks__/configMock";
import { setMockProfileData } from "../../../__mocks__/hooks/api/profile";
import {
  setMockRuntimeDataOnce,
  getMockRuntimeDataWithPhones,
  getMockRuntimeDataWithBundle,
  getMockRuntimeDataWithoutPremium,
} from "../../../__mocks__/hooks/api/runtimeData";
import { mockUseFxaFlowTrackerModule } from "../../../__mocks__/hooks/fxaFlowTracker";
import { mockUseL10nModule } from "../../../__mocks__/hooks/l10n";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockReactGa } from "../../../__mocks__/modules/react-ga";

jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/gaViewPing.ts");
jest.mock("../../hooks/gaEvent.ts");
jest.mock("../../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);
jest.mock("../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../components/Localized.tsx", () => mockLocalizedModule);

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

  it("renders mobile plan headers", () => {
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
