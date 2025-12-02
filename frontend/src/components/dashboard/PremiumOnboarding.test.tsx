import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PremiumOnboarding } from "./PremiumOnboarding";
import { mockedProfiles } from "../../../__mocks__/api/mockData";
import { supportsFirefoxExtension } from "../../functions/userAgent";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import { renderWithProviders } from "frontend/__mocks__/modules/renderWithProviders";

jest.mock("../../functions/userAgent");
jest.mock("../../hooks/mediaQuery");
jest.mock("../../config", () => ({
  getRuntimeConfig: () => ({
    mozmailDomain: "mozmail.test",
  }),
}));

describe("PremiumOnboarding", () => {
  const mockL10nGetString = jest.fn((id: string) => id);

  beforeEach(() => {
    global.useL10nImpl = () => ({
      getString: mockL10nGetString,
    });

    (supportsFirefoxExtension as jest.Mock).mockReturnValue(true);
    (useMinViewportWidth as jest.Mock).mockReturnValue(true);
  });

  it("renders Step 1 and continues to Step 2", async () => {
    const user = userEvent.setup();
    const onNextStep = jest.fn();
    const onPickSubdomain = jest.fn();

    renderWithProviders(
      <PremiumOnboarding
        profile={{ ...mockedProfiles.full, onboarding_state: 0 }}
        onNextStep={onNextStep}
        onPickSubdomain={onPickSubdomain}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "multi-part-onboarding-premium-welcome-headline",
      }),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", {
      name: "multi-part-onboarding-premium-welcome-feature-cta",
    });
    await user.click(button);

    expect(onNextStep).toHaveBeenCalledWith(1);
  });

  it("renders Step 2 with subdomain search when subdomain is null", async () => {
    const user = userEvent.setup();
    const onNextStep = jest.fn();
    const onPickSubdomain = jest.fn();
    const profile = {
      ...mockedProfiles.full,
      onboarding_state: 1,
      subdomain: null,
    };

    renderWithProviders(
      <PremiumOnboarding
        profile={profile}
        onNextStep={onNextStep}
        onPickSubdomain={onPickSubdomain}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "multi-part-onboarding-premium-email-domain-headline",
      }),
    ).toBeInTheDocument();

    const skipButton = screen.getByRole("button", {
      name: "multi-part-onboarding-skip",
    });
    await user.click(skipButton);

    expect(onNextStep).toHaveBeenCalledWith(2);
  });

  it("renders Step 2 with continue button and skips to dashboard when subdomain is set", async () => {
    const user = userEvent.setup();
    const onNextStep = jest.fn();

    renderWithProviders(
      <PremiumOnboarding
        profile={{
          ...mockedProfiles.full,
          onboarding_state: 1,
          subdomain: "test-sub",
        }}
        onNextStep={onNextStep}
        onPickSubdomain={jest.fn()}
      />,
    );

    const button = screen.getByRole("button", {
      name: "multi-part-onboarding-continue",
    });
    await user.click(button);

    expect(onNextStep).toHaveBeenCalledWith(3);
  });

  it("renders Step 3 and allows skipping extension", async () => {
    const user = userEvent.setup();
    const onNextStep = jest.fn();

    renderWithProviders(
      <PremiumOnboarding
        profile={{ ...mockedProfiles.full, onboarding_state: 2 }}
        onNextStep={onNextStep}
        onPickSubdomain={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "multi-part-onboarding-premium-add-extension-headline",
      }),
    ).toBeInTheDocument();

    const skipButton = screen.getByRole("button", {
      name: "multi-part-onboarding-skip-download-extension",
    });
    await user.click(skipButton);

    expect(onNextStep).toHaveBeenCalledWith(3);
  });

  it("renders progress bar with correct value and max", () => {
    renderWithProviders(
      <PremiumOnboarding
        profile={{ ...mockedProfiles.full, onboarding_state: 1 }}
        onNextStep={jest.fn()}
        onPickSubdomain={jest.fn()}
      />,
    );

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveValue(2);
    expect(progress).toHaveAttribute("max", "3");
  });

  describe("non-Firefox browsers", () => {
    beforeEach(() => {
      (supportsFirefoxExtension as jest.Mock).mockReturnValue(false);
    });

    it("goes to step 3 when continuing after subdomain creation", async () => {
      const user = userEvent.setup();
      const onNextStep = jest.fn();

      renderWithProviders(
        <PremiumOnboarding
          profile={{
            ...mockedProfiles.full,
            onboarding_state: 1,
            subdomain: "test-sub",
          }}
          onNextStep={onNextStep}
          onPickSubdomain={jest.fn()}
        />,
      );

      const button = screen.getByRole("button", {
        name: "multi-part-onboarding-continue",
      });
      await user.click(button);

      expect(onNextStep).toHaveBeenCalledWith(2);
    });

    it("skips step 3 when skipping subdomain creation", async () => {
      const user = userEvent.setup();
      const onNextStep = jest.fn();
      const profile = {
        ...mockedProfiles.full,
        onboarding_state: 1,
        subdomain: null,
      };

      renderWithProviders(
        <PremiumOnboarding
          profile={profile}
          onNextStep={onNextStep}
          onPickSubdomain={jest.fn()}
        />,
      );

      const skipButton = screen.getByRole("button", {
        name: "multi-part-onboarding-skip",
      });
      await user.click(skipButton);

      expect(onNextStep).toHaveBeenCalledWith(3);
    });

    it("renders progress bar with max of 2 steps", () => {
      renderWithProviders(
        <PremiumOnboarding
          profile={{ ...mockedProfiles.full, onboarding_state: 1 }}
          onNextStep={jest.fn()}
          onPickSubdomain={jest.fn()}
        />,
      );

      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("max", "2");
    });
  });
});
