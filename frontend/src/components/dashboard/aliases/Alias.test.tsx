import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alias } from "./Alias";
import type { AliasData } from "../../../hooks/api/aliases";

import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import { getMockRuntimeDataWithBundle } from "../../../../__mocks__/hooks/api/runtimeData";
import { UserData } from "../../../hooks/api/user";

jest.mock("../../../functions/waffle", () => {
  const { mockIsFlagActive } = jest.requireActual(
    "frontend/__mocks__/functions/flags",
  );
  return { isFlagActive: mockIsFlagActive };
});
import { setFlags } from "frontend/__mocks__/functions/flags";

jest.mock("../../../../public/illustrations/holiday.svg", () => ({
  __esModule: true,
  default: { src: "holiday.svg" },
}));

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

jest.mock("./LabelEditor", () => ({
  LabelEditor: ({
    label,
    onSubmit,
  }: {
    label: string;
    onSubmit: (val: string) => void;
  }) => (
    <div data-testid="label-editor">
      <button onClick={() => onSubmit("New Label")}>Submit Label</button>
      <span>{label}</span>
    </div>
  ),
}));

jest.mock("./AliasDeletionButtonPermanent", () => ({
  AliasDeletionButtonPermanent: ({ onDelete }: { onDelete: () => void }) => (
    <button data-testid="delete-button" onClick={onDelete}>
      Delete Alias
    </button>
  ),
}));

jest.mock("./BlockLevelSlider", () => ({
  BlockLevelSlider: ({ onChange }: { onChange: (level: string) => void }) => (
    <button data-testid="block-slider" onClick={() => onChange("all")}>
      Set Block Level
    </button>
  ),
}));

jest.mock("../../../functions/getPlan", () => ({
  isPeriodicalPremiumAvailableInCountry: () => true,
}));
jest.mock("../../../functions/getLocale", () => ({
  getLocale: () => "en-US",
}));

jest.mock("../../../config");

describe("Alias", () => {
  const alias: AliasData = {
    id: 123,
    mask_type: "random",
    domain: 1,
    generated_for: "me@example.com",
    enabled: true,
    block_list_emails: false,
    block_level_one_trackers: false,
    description: "Holiday",
    address: "abc123",
    full_address: "abc123@relay.firefox.com",
    created_at: "2023-01-01T00:00:00Z",
    last_modified_at: "2023-01-01T01:00:00Z",
    last_used_at: null,
    num_blocked: 5,
    num_forwarded: 3,
    num_spam: 0,
    num_replied: 1,
    num_level_one_trackers_blocked: 2,
    used_on: "",
  };

  const profile = getMockProfileData();
  const runtimeData = getMockRuntimeDataWithBundle();
  const userData: UserData = { email: "user@example.com" };

  beforeEach(() => {
    setFlags({
      tracker_removal: true,
    });
  });

  const setup = (
    aliasOverride: Partial<AliasData> = {},
    showLabelEditor = true,
  ) => {
    const onUpdate = jest.fn();
    const onDelete = jest.fn();
    const onChangeOpen = jest.fn();

    render(
      <Alias
        alias={{
          ...alias,
          ...aliasOverride,
          mask_type: "random",
          domain: 1,
          generated_for: "me@example.com",
        }}
        user={userData}
        profile={profile}
        onUpdate={onUpdate}
        onDelete={onDelete}
        isOpen={false}
        onChangeOpen={onChangeOpen}
        showLabelEditor={showLabelEditor}
        runtimeData={runtimeData}
      />,
    );

    return { onUpdate, onDelete, onChangeOpen };
  };

  it("renders alias address and label editor", () => {
    setup();
    expect(screen.getByText("abc123@relay.firefox.com")).toBeInTheDocument();
    expect(screen.getByTestId("label-editor")).toBeInTheDocument();
  });

  it("calls onSubmit from label editor", async () => {
    const user = userEvent.setup();
    const { onUpdate } = setup();
    await user.click(screen.getByRole("button", { name: /submit label/i }));
    expect(onUpdate).toHaveBeenCalledWith({ description: "New Label" });
  });

  it("copies address to clipboard and shows confirmation", async () => {
    const user = userEvent.setup();
    setup();

    const originalClipboardDesc = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    const writeTextMock = jest.fn();

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const copyBtn = await screen.findByTitle(/profile-label-click-to-copy/);
    await user.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith("abc123@relay.firefox.com");

    expect(await screen.findByText(/profile-label-copied/)).toBeVisible();

    if (originalClipboardDesc) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDesc);
    } else {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
    }
  });

  it("toggles expansion state", async () => {
    const user = userEvent.setup();
    const { onChangeOpen } = setup();
    await user.click(
      screen.getByRole("button", { name: /profile-details-expand/ }),
    );
    expect(onChangeOpen).toHaveBeenCalledWith(true);
  });

  it("sets block level to 'all' when block slider clicked", async () => {
    const user = userEvent.setup();
    const { onUpdate } = setup();

    await user.click(screen.getByRole("button", { name: /set block level/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("renders deletion button and triggers deletion", async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();

    await user.click(screen.getByRole("button", { name: /delete alias/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("renders tracker removal indicator when active", () => {
    setup({ block_level_one_trackers: true });
    expect(
      screen.getByRole("button", {
        name: /profile-indicator-tracker-removal-alt/,
      }),
    ).toBeInTheDocument();
  });

  it("renders holiday background image", () => {
    setup();
    const root = screen.getByTestId("alias-card");
    expect(root.style.backgroundImage).toContain("holiday.svg");
  });

  it("renders forwarded and blocked stats", () => {
    setup();
    expect(screen.getAllByText(/profile-label-forwarded/)).toHaveLength(2);
    expect(screen.getAllByText(/profile-label-blocked/)).toHaveLength(2);
  });
});
