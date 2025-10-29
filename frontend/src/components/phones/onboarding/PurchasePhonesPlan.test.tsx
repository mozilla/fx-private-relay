import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { PurchasePhonesPlan } from "./PurchasePhonesPlan";
import { RuntimeDataWithPhonesAvailable } from "../../../functions/getPlan";
import { mockedRuntimeData } from "frontend/__mocks__/api/mockData";

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

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

import { byMsgId } from "../../../../__mocks__/hooks/l10n";

describe("PurchasePhonesPlan", () => {
  const runtimeData = mockedRuntimeData as RuntimeDataWithPhonesAvailable;

  it("renders the onboarding headline and benefits list", () => {
    render(<PurchasePhonesPlan runtimeData={runtimeData} />);

    expect(
      screen.getByText(byMsgId("phone-onboarding-step1-headline")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(byMsgId("phone-onboarding-step1-body")),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders both yearly and monthly pricing options", async () => {
    const user = userEvent.setup();
    render(<PurchasePhonesPlan runtimeData={runtimeData} />);

    expect(
      screen.getByText(byMsgId("phone-onboarding-step1-period-toggle-yearly")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(byMsgId("phone-onboarding-step1-period-toggle-monthly")),
    ).toBeInTheDocument();

    expect(
      screen.getByText(byMsgId("phone-onboarding-step1-button-price")),
    ).toBeInTheDocument();

    await user.click(
      screen.getByText(byMsgId("phone-onboarding-step1-period-toggle-monthly")),
    );

    expect(
      screen.getByText(byMsgId("phone-onboarding-step1-button-price")),
    ).toBeInTheDocument();
  });

  it("has clickable links for yearly and monthly subscription", async () => {
    const user = userEvent.setup();
    render(<PurchasePhonesPlan runtimeData={runtimeData} />);

    const yearlyLink = screen.getByRole("link", {
      name: byMsgId("phone-onboarding-step1-button-cta-2"),
    });
    expect(yearlyLink).toHaveAttribute("href", "/subscribe/yearly");

    const monthlyTab = screen.getByText(
      byMsgId("phone-onboarding-step1-period-toggle-monthly"),
    );
    await user.click(monthlyTab);

    const monthlyLink = screen.getByRole("link", {
      name: byMsgId("phone-onboarding-step1-button-cta-2"),
    });
    expect(monthlyLink).toHaveAttribute("href", "/subscribe/monthly");
  });
});
