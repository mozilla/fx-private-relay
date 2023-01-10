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
    }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s
  });

  it("does not show the old Plan comparison", () => {
    render(<Home />);

    const oldGetPremiumLink = screen.queryByRole("link", {
      name: /landing-pricing-premium-feature-5/,
    });

    expect(oldGetPremiumLink).not.toBeInTheDocument();
  });

  it("shows the new feature comparison matrix", () => {
    render(<Home />);

    const comparisonMatrix = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-free], with vars: {}",
    });

    expect(comparisonMatrix).toBeInTheDocument();
  });

  it("shows the phone plan if phones is available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithPhones());

    render(<Home />);

    const phoneColumn = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-phones], with vars: {}",
    });

    expect(phoneColumn).toBeInTheDocument();
  });

  it("shows the phone feature if phones is available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithPhones());

    render(<Home />);

    const phoneFeatureRow = screen.getByRole("rowheader", {
      name: "[<Localized> with id [plan-matrix-heading-feature-phone-mask] and vars: {}]",
    });

    expect(phoneFeatureRow).toBeInTheDocument();
  });

  it("links to the waitlist if phones is not available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithoutPremium());

    render(<Home />);

    const waitlistLinks = screen.getAllByRole("link", {
      name: "l10n string: [plan-matrix-join-waitlist], with vars: {}",
    });

    const linkTargets = waitlistLinks.map((el) => el.getAttribute("href"));
    expect(linkTargets).toContain("/phone/waitlist");
  });

  it("shows the phone feature even if phones is not available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithoutPremium());

    render(<Home />);

    const phoneFeatureRow = screen.getByRole("rowheader", {
      name: "[<Localized> with id [plan-matrix-heading-feature-phone-mask] and vars: {}]",
    });

    expect(phoneFeatureRow).toBeInTheDocument();
  });

  it("shows the bundle plan if bundle is available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithBundle());

    render(<Home />);

    const bundleColumn = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-bundle], with vars: {}",
    });

    expect(bundleColumn).toBeInTheDocument();
  });

  it("links to the waitlist if bundle is not available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithoutPremium());

    render(<Home />);

    const waitlistLinks = screen.getAllByRole("link", {
      name: "l10n string: [plan-matrix-join-waitlist], with vars: {}",
    });

    const linkTargets = waitlistLinks.map((el) => el.getAttribute("href"));
    expect(linkTargets).toContain("/vpn-relay/waitlist");
  });

  it("shows the VPN feature if bundle is available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithBundle());

    render(<Home />);

    const vpnFeatureRow = screen.getByRole("rowheader", {
      name: "[<Localized> with id [plan-matrix-heading-feature-vpn] and vars: {}]",
    });

    expect(vpnFeatureRow).toBeInTheDocument();
  });

  it("shows the bundle plan even if phones and bundle are not available in the user's country", () => {
    setMockRuntimeDataOnce(getMockRuntimeDataWithoutPremium());

    render(<Home />);

    const vpnFeatureRow = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-bundle], with vars: {}",
    });

    expect(vpnFeatureRow).toBeInTheDocument();
  });
});
