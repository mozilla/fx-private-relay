import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FreeOnboarding, Props } from "./FreeOnboarding";
import { useL10n } from "../../hooks/l10n";
import { RandomAliasData, AliasData } from "../../hooks/api/aliases";
import { ProfileData } from "../../hooks/api/profile";
import { UserData } from "../../hooks/api/user";

jest.mock("next/config", () => () => ({
  publicRuntimeConfig: {
    maxOnboardingAvailable: 3,
  },
}));

jest.mock("../../hooks/l10n", () => ({
  useL10n: jest.fn(),
}));

jest.mock("../../hooks/gaEvent", () => ({
  useGaEvent: jest.fn(() => jest.fn()),
}));

jest.mock("../../hooks/gaViewPing", () => ({
  useGaViewPing: jest.fn(() => null),
}));

jest.mock("../../functions/userAgent", () => ({
  supportsFirefoxExtension: () => true,
}));

const mockAlias: AliasData = {
  id: 123,
  email: "my-alias@relay.mozilla.com",
  full_address: "my-alias@relay.mozilla.com",
  enabled: true,
  created_at: "2024-01-01T00:00:00Z",
  last_modified_at: "2024-01-01T00:00:00Z",
  last_used_at: null,
  label: "Test",
  description: "sample alias",
  domain: 1,
  subdomain: "my-alias",
  address: "my-alias",
  mask_type: "random",
  block_list_emails: false,
  block_level_one_trackers: false,
  num_forwarded: 0,
  num_blocked: 0,
  num_spam: 0,
  num_replied: 0,
  num_level_one_trackers_blocked: 0,
  used_on: "",
  generated_for: "",
} as RandomAliasData;

const mockL10nGetString = jest.fn((key) => key);
(useL10n as jest.Mock).mockReturnValue({
  getString: mockL10nGetString,
  bundles: [{ locales: ["en"] }],
});

const baseProps: Props = {
  profile: {
    onboarding_free_state: 0,
    server_storage: false,
  } as ProfileData,
  onNextStep: jest.fn(),
  onPickSubdomain: jest.fn(),
  generateNewMask: jest.fn(() => Promise.resolve()),
  hasReachedFreeMaskLimit: false,
  aliases: [mockAlias],
  user: {
    email: "user@example.com",
  } as UserData,
  runtimeData: undefined,
  onUpdate: jest.fn(),
  hasAtleastOneMask: true,
};

describe("FreeOnboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Step 1 and handles mask creation", async () => {
    render(
      <FreeOnboarding
        {...baseProps}
        profile={{ ...baseProps.profile, onboarding_free_state: 0 }}
      />,
    );

    expect(
      screen.getByText("profile-free-onboarding-welcome-headline"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "profile-free-onboarding-welcome-generate-new-mask",
      }),
    );

    await waitFor(() =>
      expect(baseProps.generateNewMask).toHaveBeenCalledWith({
        mask_type: "random",
      }),
    );

    await waitFor(() => expect(baseProps.onNextStep).toHaveBeenCalledWith(1));
  });

  it("renders Step 2 and opens forwarding modal", () => {
    render(
      <FreeOnboarding
        {...baseProps}
        profile={{ ...baseProps.profile, onboarding_free_state: 1 }}
      />,
    );

    const modalButton = screen.getByTestId("open-forwarding-modal");
    fireEvent.click(modalButton);

    expect(screen.getByTestId("copy-mask-item-headline")).toBeInTheDocument();
  });

  it("renders Step 3 with extension instructions and completes onboarding", () => {
    render(
      <FreeOnboarding
        {...baseProps}
        profile={{ ...baseProps.profile, onboarding_free_state: 2 }}
      />,
    );

    expect(
      screen.getByText("profile-free-onboarding-addon-headline"),
    ).toBeInTheDocument();

    const finishButton = screen.getByRole("button", {
      name: "profile-free-onboarding-addon-finish",
    });
    fireEvent.click(finishButton);

    expect(baseProps.onNextStep).toHaveBeenCalledWith(4);
  });
});
