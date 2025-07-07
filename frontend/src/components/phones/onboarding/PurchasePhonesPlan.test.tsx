import { render, screen, fireEvent } from "@testing-library/react";
import { PurchasePhonesPlan } from "./PurchasePhonesPlan";
import { RuntimeDataWithPhonesAvailable } from "../../../functions/getPlan";
import { mockedRuntimeData } from "frontend/src/apiMocks/mockData";

jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string, vars?: Record<string, string>) =>
      vars
        ? `l10n string: [${id}] with vars: ${JSON.stringify(vars)}`
        : `l10n string: [${id}]`,
  }),
}));

jest.mock("../../../hooks/gaViewPing", () => ({
  useGaViewPing: () => ({ current: null }),
}));

jest.mock("../../../hooks/gaEvent", () => ({
  useGaEvent: () => jest.fn(),
}));

jest.mock("../../../functions/trackPurchase", () => ({
  trackPlanPurchaseStart: jest.fn(),
}));

jest.mock("../../../functions/getPlan", () => {
  const actual = jest.requireActual("../../../functions/getPlan");
  return {
    ...actual,
    getPhonesPrice: jest.fn(() => "$9.99"),
    getPhoneSubscribeLink: jest.fn((_, period) => `/subscribe/${period}`),
  };
});

describe("PurchasePhonesPlan", () => {
  const runtimeData = mockedRuntimeData as RuntimeDataWithPhonesAvailable;

  it("renders the onboarding headline and benefits list", () => {
    render(<PurchasePhonesPlan runtimeData={runtimeData} />);

    expect(
      screen.getByText(/phone-onboarding-step1-headline/),
    ).toBeInTheDocument();
    expect(screen.getByText(/phone-onboarding-step1-body/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders both yearly and monthly pricing options", () => {
    render(<PurchasePhonesPlan runtimeData={runtimeData} />);

    expect(
      screen.getByText(/phone-onboarding-step1-period-toggle-yearly/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/phone-onboarding-step1-period-toggle-monthly/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/phone-onboarding-step1-button-price/),
    ).toHaveLength(2);
  });

  it("has clickable links for yearly and monthly subscription", () => {
    render(<PurchasePhonesPlan runtimeData={runtimeData} />);

    // Yearly is selected by default
    const yearlyLink = screen.getByRole("link", {
      name: /phone-onboarding-step1-button-cta-2/,
    });
    expect(yearlyLink).toHaveAttribute("href", "/subscribe/yearly");

    // Switch to monthly tab
    const monthlyTab = screen.getByText(
      /phone-onboarding-step1-period-toggle-monthly/,
    );
    fireEvent.click(monthlyTab);

    const monthlyLink = screen.getByRole("link", {
      name: /phone-onboarding-step1-button-cta-2/,
    });
    expect(monthlyLink).toHaveAttribute("href", "/subscribe/monthly");
  });
});
