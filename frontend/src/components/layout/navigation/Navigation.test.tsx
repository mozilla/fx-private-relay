import { render, screen } from "@testing-library/react";
import { setMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithPeriodicalPremium,
  getMockRuntimeDataWithPhones,
  setMockRuntimeData,
} from "../../../../__mocks__/hooks/api/runtimeData";
import { setMockUserData } from "../../../../__mocks__/hooks/api/user";

import { Navigation } from "./Navigation";

setMockRuntimeData();
setMockProfileData();
setMockUserData();

describe("<Navigation>", () => {
  it("links to the landing page when the user is not logged in", () => {
    render(
      <Navigation
        handleToggle={jest.fn()}
        hasPremium={false}
        isLoggedIn={false}
        theme="free"
      />,
    );

    const landingLink = screen.getByRole("link", {
      name: "l10n string: [nav-home], with vars: {}",
    });

    expect(landingLink).toBeInTheDocument();
  });

  it("links to the email dashboard when the user is logged in", () => {
    render(
      <Navigation
        handleToggle={jest.fn()}
        hasPremium={false}
        isLoggedIn={true}
        theme="premium"
      />,
    );

    const emailDashboardLink = screen.getByRole("link", {
      name: "l10n string: [nav-email-dashboard], with vars: {}",
    });

    expect(emailDashboardLink).toBeInTheDocument();
  });

  it("does not link to the phone dashboard when the user can not purchase phone masking", () => {
    setMockRuntimeData(getMockRuntimeDataWithPeriodicalPremium());
    render(
      <Navigation
        handleToggle={jest.fn()}
        hasPremium={true}
        isLoggedIn={true}
        theme="premium"
      />,
    );

    const phoneDashboardLink = screen.queryByRole("link", {
      name: "l10n string: [nav-phone-dashboard], with vars: {}",
    });

    expect(phoneDashboardLink).not.toBeInTheDocument();
  });

  it("links to the phone dashboard when the user can purchase phone masking", () => {
    setMockRuntimeData(getMockRuntimeDataWithPhones());
    render(
      <Navigation
        handleToggle={jest.fn()}
        hasPremium={true}
        isLoggedIn={true}
        theme="premium"
      />,
    );

    const phoneDashboardLink = screen.getByRole("link", {
      name: "l10n string: [nav-phone-dashboard], with vars: {}",
    });

    expect(phoneDashboardLink).toBeInTheDocument();
  });
});
