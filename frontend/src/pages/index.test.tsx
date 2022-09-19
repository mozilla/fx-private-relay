import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { mockConfigModule } from "../../__mocks__/configMock";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithBundle,
  getMockRuntimeDataWithPhones,
  setMockRuntimeData,
  setMockRuntimeDataOnce,
} from "../../__mocks__/hooks/api/runtimeData";
import { mockUseFxaFlowTrackerModule } from "../../__mocks__/hooks/fxaFlowTracker";
import { mockFluentReact } from "../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../__mocks__/modules/next__router";
import { mockReactGa } from "../../__mocks__/modules/react-ga";

import Home from "./index.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../config.ts", () => mockConfigModule);
jest.mock("../hooks/gaViewPing.ts");
jest.mock("../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);

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

  it("shows the old Plan comparison if the `intro_pricing_countdown` flag is disabled", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [["intro_pricing_countdown", false]],
    });

    render(<Home />);

    const oldGetPremiumLink = screen.getByRole("link", {
      name: /landing-pricing-premium-feature-5/,
    });

    expect(oldGetPremiumLink).toBeInTheDocument();
  });

  it("shows the countdown timer if the `intro_pricing_countdown` flag is enabled and the deadline is tomorrow", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [["intro_pricing_countdown", true]],
      INTRO_PRICING_END: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    render(<Home />);

    const countdownTimerCta = screen.getByRole("link", {
      name: "l10n string: [landing-offer-end-hero-cta], with vars: {}",
    });

    expect(countdownTimerCta).toBeInTheDocument();
  });

  it("does not show the old Plan comparison if the `intro_pricing_countdown` flag is enabled and the deadline has passed", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [["intro_pricing_countdown", true]],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const oldGetPremiumLink = screen.queryByRole("link", {
      name: /landing-pricing-premium-feature-5/,
    });

    expect(oldGetPremiumLink).not.toBeInTheDocument();
  });

  it("shows the new feature comparison matrix if the `intro_pricing_countdown` flag is enabled and the deadline has passed", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [["intro_pricing_countdown", true]],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const comparisonMatrix = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-free], with vars: {}",
    });

    expect(comparisonMatrix).toBeInTheDocument();
  });

  it("shows the phone plan if the `phones` flag is enabled and phones is available in the user's country", () => {
    setMockRuntimeDataOnce({
      ...getMockRuntimeDataWithPhones(),
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["phones", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const phoneColumn = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-phones], with vars: {}",
    });

    expect(phoneColumn).toBeInTheDocument();
  });

  it("shows the phone feature if the `phones` flag is enabled and phones is available in the user's country", () => {
    setMockRuntimeDataOnce({
      ...getMockRuntimeDataWithPhones(),
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["phones", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const phoneFeatureRow = screen.getByRole("rowheader", {
      name: "[<Localized> with id [plan-matrix-heading-feature-phone-mask] and vars: {}]",
    });

    expect(phoneFeatureRow).toBeInTheDocument();
  });

  it("does not show the phone plan if the `phones` flag is not enabled", () => {
    setMockRuntimeDataOnce({
      ...getMockRuntimeDataWithPhones(),
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["phones", false],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const phoneColumn = screen.queryByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-phones], with vars: {}",
    });

    expect(phoneColumn).not.toBeInTheDocument();
  });

  it("does not show the phone plan if the `phones` flag is enabled but phones is not available in the user's country", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["phones", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const phoneColumn = screen.queryByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-phones], with vars: {}",
    });

    expect(phoneColumn).not.toBeInTheDocument();
  });

  it("does not show the phone feature if the `phones` flag is enabled but phones is not available in the user's country", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["phones", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const phoneFeatureRow = screen.queryByRole("rowheader", {
      name: "[<Localized> with id [plan-matrix-heading-feature-phone_mask] and vars: {}]",
    });

    expect(phoneFeatureRow).not.toBeInTheDocument();
  });

  it("shows the bundle plan if the `bundle` flag is enabled and bundle is available in the user's country", () => {
    setMockRuntimeDataOnce({
      ...getMockRuntimeDataWithBundle(),
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["bundle", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const bundleColumn = screen.getByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-bundle], with vars: {}",
    });

    expect(bundleColumn).toBeInTheDocument();
  });

  it("shows the VPN feature if the `bundle` flag is enabled and bundle is available in the user's country", () => {
    setMockRuntimeDataOnce({
      ...getMockRuntimeDataWithBundle(),
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["bundle", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const vpnFeatureRow = screen.getByRole("rowheader", {
      name: "[<Localized> with id [plan-matrix-heading-feature-vpn] and vars: {}]",
    });

    expect(vpnFeatureRow).toBeInTheDocument();
  });

  it("does not show the phone bundle if the `bundle` flag is not enabled", () => {
    setMockRuntimeDataOnce({
      ...getMockRuntimeDataWithBundle(),
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["bundle", false],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const bundleColumn = screen.queryByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-bundle], with vars: {}",
    });

    expect(bundleColumn).not.toBeInTheDocument();
  });

  it("does not show the bundle plan if the `bundle` flag is enabled but phones is not available in the user's country", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["bundle", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const vpnFeatureRow = screen.queryByRole("columnheader", {
      name: "l10n string: [plan-matrix-heading-plan-vpn], with vars: {}",
    });

    expect(vpnFeatureRow).not.toBeInTheDocument();
  });

  it("does not show the VPN feature if the `bundle` flag is enabled but bundle is not available in the user's country", () => {
    setMockRuntimeDataOnce({
      WAFFLE_FLAGS: [
        ["intro_pricing_countdown", true],
        ["bundle", true],
      ],
      INTRO_PRICING_END: new Date(Date.now() - 42).toISOString(),
    });

    render(<Home />);

    const vpnFeatureRow = screen.queryByRole("rowheader", {
      name: "[<Localized> with id [plan-matrix-heading-feature-vpn] and vars: {}]",
    });

    expect(vpnFeatureRow).not.toBeInTheDocument();
  });
});
