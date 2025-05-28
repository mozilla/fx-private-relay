import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockLocalizedModule } from "../../__mocks__/components/Localized";
import { mockConfigModule } from "../../__mocks__/configMock";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithMegabundle,
  getMockRuntimeDataWithBundle,
  getMockRuntimeDataWithoutPremium,
  setMockRuntimeDataOnce,
} from "../../__mocks__/hooks/api/runtimeData";
import { mockUseFxaFlowTrackerModule } from "../../__mocks__/hooks/fxaFlowTracker";
import { mockUseL10nModule } from "../../__mocks__/hooks/l10n";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

// Ensure mocks are in place before component import
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");
jest.mock("../hooks/gaEvent.ts");
jest.mock("../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);
jest.mock("../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../components/Localized.tsx", () => mockLocalizedModule);

import PremiumPromo from "./premium.page";

// Set profile to unauthenticated state
setMockProfileData(null);

describe("The promotional page about Relay Premium", () => {
  it("passes axe accessibility testing", async () => {
    // Ensure runtime data is set to avoid undefined `.data`
    setMockRuntimeDataOnce(getMockRuntimeDataWithBundle());

    const { baseElement } = render(<PremiumPromo />);
    let results;
    await act(async () => {
      results = await axe(baseElement);
    });

    expect(results).toHaveNoViolations();
  }, 10000);

  it("shows the megabundle banner if megabundle is available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithMegabundle());

    render(<PremiumPromo />);

    const heading = screen.getByText((content) =>
      content.startsWith("l10n string: [megabundle-banner-header], with vars:"),
    );
    expect(heading).toBeInTheDocument();
  });

  it("shows the bundle banner if megabundle is not available but bundle is", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithBundle());

    render(<PremiumPromo />);

    const bundleColumn = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-bundle-2], with vars: {}",
    });

    expect(bundleColumn).toBeInTheDocument();
  });

  it("shows a waitlist link when premium is not available", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithoutPremium());

    render(<PremiumPromo />);

    const waitlistLink = screen.getByRole("link", {
      name: "l10n string: [waitlist-submit-label-2], with vars: {}",
    });

    expect(waitlistLink).toHaveAttribute("href", "/premium/waitlist");
  });

  it("shows the plan matrix section", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithBundle());

    render(<PremiumPromo />);

    const freeColumnHeader = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-free], with vars: {}",
    });

    expect(freeColumnHeader).toBeInTheDocument();
  });
});
