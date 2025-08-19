import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Alias } from "./Alias";
import {
  mockedUsers,
  mockedProfiles,
  mockedRuntimeData,
} from "../../../apiMocks/mockData";
import { AliasData } from "../../../hooks/api/aliases";

jest.mock("../../../../public/illustrations/holiday.svg", () => ({
  __esModule: true,
  default: { src: "holiday.svg" },
}));

jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string, vars?: Record<string, string | number>) =>
      id === "profile-label-click-to-copy-alt" && vars?.address
        ? `Copy ${vars.address}`
        : id,
  }),
}));

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

jest.mock("./AliasDeletionButton", () => ({
  AliasDeletionButton: ({ onDelete }: { onDelete: () => void }) => (
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

jest.mock("../../../functions/waffle", () => ({
  isFlagActive: () => true,
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
        user={mockedUsers.full}
        profile={mockedProfiles.full}
        onUpdate={onUpdate}
        onDelete={onDelete}
        isOpen={false}
        onChangeOpen={onChangeOpen}
        showLabelEditor={showLabelEditor}
        runtimeData={mockedRuntimeData}
      />,
    );

    return { onUpdate, onDelete, onChangeOpen };
  };

  it("renders alias address and label editor", () => {
    setup();
    expect(screen.getByText("abc123@relay.firefox.com")).toBeInTheDocument();
    expect(screen.getByTestId("label-editor")).toBeInTheDocument();
  });

  it("calls onSubmit from label editor", () => {
    const { onUpdate } = setup();
    fireEvent.click(screen.getByText("Submit Label"));
    expect(onUpdate).toHaveBeenCalledWith({ description: "New Label" });
  });

  it("copies address to clipboard and shows confirmation", async () => {
    setup();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn() },
    });

    fireEvent.click(screen.getByTitle("profile-label-click-to-copy"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "abc123@relay.firefox.com",
    );

    await waitFor(() =>
      expect(screen.getByText("profile-label-copied")).toBeVisible(),
    );
  });

  it("toggles expansion state", () => {
    const { onChangeOpen } = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "profile-details-expand" }),
    );
    expect(onChangeOpen).toHaveBeenCalledWith(true);
  });

  it("sets block level to 'all' when block slider clicked", () => {
    const { onUpdate } = setup();
    fireEvent.click(screen.getByTestId("block-slider"));
    expect(onUpdate).toHaveBeenCalledWith({
      enabled: false,
      block_list_emails: true,
    });
  });

  it("renders deletion button and triggers deletion", () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByTestId("delete-button"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("renders tracker removal indicator when active", () => {
    setup({ block_level_one_trackers: true });
    expect(
      screen.getByRole("button", {
        name: "profile-indicator-tracker-removal-alt",
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
    expect(screen.getAllByText("profile-label-forwarded")).toHaveLength(2);
    expect(screen.getAllByText("profile-label-blocked")).toHaveLength(2);
  });
});
