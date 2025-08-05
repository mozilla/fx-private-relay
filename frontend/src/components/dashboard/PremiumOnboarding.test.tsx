import { render, screen, fireEvent } from "@testing-library/react";
import { PremiumOnboarding } from "./PremiumOnboarding";
import { mockedProfiles } from "../../apiMocks/mockData";
import { useL10n } from "../../hooks/l10n";
import { supportsFirefoxExtension } from "../../functions/userAgent";
import { useMinViewportWidth } from "../../hooks/mediaQuery";

import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { FluentBundle, FluentResource } from "@fluent/bundle";

jest.mock("../../hooks/l10n");
jest.mock("../../hooks/gaViewPing", () => ({
  useGaViewPing: () => undefined,
}));
jest.mock("../../hooks/gaEvent", () => ({
  useGaEvent: () => jest.fn(),
}));
jest.mock("../../functions/userAgent");
jest.mock("../../hooks/mediaQuery");
jest.mock("../../config", () => ({
  getRuntimeConfig: () => ({
    mozmailDomain: "mozmail.test",
  }),
}));

const MockL10nProvider = ({ children }: { children: React.ReactNode }) => {
  const resource = new FluentResource("");
  const bundle = new FluentBundle("en-US");
  bundle.addResource(resource);
  const l10n = new ReactLocalization([bundle]);

  return <LocalizationProvider l10n={l10n}>{children}</LocalizationProvider>;
};
MockL10nProvider.displayName = "MockL10nProvider";

const renderWithL10n = (ui: React.ReactElement) => {
  return render(<MockL10nProvider>{ui}</MockL10nProvider>);
};

describe("PremiumOnboarding", () => {
  const mockL10nGetString = jest.fn((id: string) => id);

  beforeEach(() => {
    (useL10n as jest.Mock).mockReturnValue({
      getString: mockL10nGetString,
    });

    (supportsFirefoxExtension as jest.Mock).mockReturnValue(true);
    (useMinViewportWidth as jest.Mock).mockReturnValue(true);
  });

  it("renders Step 1 and continues to Step 2", () => {
    const onNextStep = jest.fn();
    const onPickSubdomain = jest.fn();

    renderWithL10n(
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
    fireEvent.click(button);

    expect(onNextStep).toHaveBeenCalledWith(1);
  });

  it("renders Step 2 with subdomain search when subdomain is null", () => {
    const onNextStep = jest.fn();
    const onPickSubdomain = jest.fn();
    const profile = {
      ...mockedProfiles.full,
      onboarding_state: 1,
      subdomain: null,
    };

    renderWithL10n(
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
    fireEvent.click(skipButton);

    expect(onNextStep).toHaveBeenCalledWith(2);
  });

  it("renders Step 2 with continue button when subdomain is set", () => {
    const onNextStep = jest.fn();

    renderWithL10n(
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
    fireEvent.click(button);

    expect(onNextStep).toHaveBeenCalledWith(2);
  });

  it("renders Step 3 and allows skipping extension", () => {
    const onNextStep = jest.fn();

    renderWithL10n(
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
    fireEvent.click(skipButton);

    expect(onNextStep).toHaveBeenCalledWith(3);
  });

  it("renders progress bar with correct value and max", () => {
    renderWithL10n(
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
});
