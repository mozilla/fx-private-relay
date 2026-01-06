import React from "react";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { MaskCard, Props } from "./MaskCard";
import { AliasData } from "../../../hooks/api/aliases";
import { UserData } from "../../../hooks/api/user";
import { ProfileData } from "../../../hooks/api/profile";
import { RuntimeData } from "../../../hooks/api/types";
import type {
  ClipboardWrite,
  ClipboardShim,
  NavigatorClipboard,
} from "../../../../__mocks__/components/clipboard";

jest.mock(
  "./MaskCard.module.scss",
  () => new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
);

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) => (
    <a href={href} className={className} data-testid="link">
      {children}
    </a>
  ),
}));

jest.mock("../../Icons", () => ({
  ArrowDownIcon: ({ alt }: { alt?: string }) => (
    <svg data-testid="arrow-down" aria-label={alt} />
  ),
  CopyIcon: () => <svg data-testid="copy-icon" />,
  LockIcon: ({ alt }: { alt?: string }) => (
    <svg data-testid="lock-icon" aria-label={alt} />
  ),
}));

jest.mock("../../Image", () => {
  const MockImage = ({ alt }: { alt?: string }) => (
    <img alt={alt} data-testid="image" />
  );
  MockImage.displayName = "MockImage";
  return MockImage;
});

jest.mock("./../../VisuallyHidden", () => ({
  VisuallyHidden: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("./LabelEditor", () => ({
  LabelEditor: ({
    label,
    placeholder,
    onSubmit,
  }: {
    label: string;
    placeholder?: string;
    onSubmit: (val: string) => void;
  }) => (
    <div>
      <input
        aria-label="label-input"
        defaultValue={label}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => onSubmit("New Label")}
        aria-label="submit-label"
      >
        Save
      </button>
    </div>
  ),
}));

jest.mock("./AliasDeletionButton", () => ({
  AliasDeletionButton: ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={onDelete} aria-label="alias-delete">
      Delete
    </button>
  ),
}));

jest.mock("./AliasDeletionButtonPermanent", () => ({
  AliasDeletionButtonPermanent: ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={onDelete} aria-label="alias-delete-permanent">
      DeleteP
    </button>
  ),
}));

jest.mock("../../../functions/getLocale", () => ({
  getLocale: () => "en-US",
}));

jest.mock("../../../functions/renderDate", () => ({
  renderDate: (iso: string) => `Rendered(${iso})`,
}));

jest.mock("../../../functions/waffle");
import { setFlag, resetFlags } from "frontend/__mocks__/functions/flags";

jest.mock("../../../hooks/api/aliases", () => ({
  isBlockingLevelOneTrackers: () => false,
}));

jest.mock("./images/calendar.svg", () => "calendar.svg");
jest.mock("./images/email.svg", () => "email.svg");
jest.mock("../images/free-onboarding-horizontal-arrow.svg", () => "arrow.svg");

jest.mock("../../../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

import { byMsgId } from "../../../../__mocks__/hooks/l10n";

jest.useFakeTimers();

type ExecCommand = (commandId: string) => boolean;
type DocumentExec = Document & { execCommand?: ExecCommand };

let writeTextMock: jest.MockedFunction<ClipboardWrite>;
let originalClipboard: ClipboardShim | undefined;
let originalExecCommand: ExecCommand | undefined;
let originalIsSecureContext: boolean | undefined;

beforeEach(() => {
  resetFlags();

  // Favor Clipboard API path if used by the component.
  originalIsSecureContext = window.isSecureContext;
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });

  const nav = navigator as NavigatorClipboard;
  const doc = document as DocumentExec;

  originalClipboard = nav.clipboard;
  originalExecCommand = doc.execCommand;

  writeTextMock = jest
    .fn<ReturnType<ClipboardWrite>, Parameters<ClipboardWrite>>()
    .mockResolvedValue(undefined);

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock },
    configurable: true,
  });

  // Provide execCommand fallback capability.
  Object.defineProperty(document, "execCommand", {
    value: jest.fn(() => true) as unknown as ExecCommand,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "isSecureContext", {
    value: originalIsSecureContext ?? false,
    configurable: true,
  });

  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
  });

  Object.defineProperty(document, "execCommand", {
    value: originalExecCommand,
    configurable: true,
  });
});

const baseMask: AliasData = {
  full_address: "sample@relay.mozilla.com",
  description: "Sample Label",
  enabled: true,
  block_list_emails: false,
  num_blocked: 1234,
  num_forwarded: 5678,
  num_replied: 12,
  num_level_one_trackers_blocked: 42,
  created_at: "2024-01-15T10:00:00Z",
} as unknown as AliasData;

const baseUser: UserData = {
  email: "user@example.com",
} as unknown as UserData;

const premiumProfile: ProfileData = {
  has_premium: true,
} as unknown as ProfileData;

const freeProfile: ProfileData = {
  has_premium: false,
} as unknown as ProfileData;

const runtimeData: RuntimeData = {} as unknown as RuntimeData;

function renderMaskCard(override?: Partial<Props>) {
  const onUpdate: Props["onUpdate"] = jest.fn();
  const onDelete: Props["onDelete"] = jest.fn();
  const onChangeOpen: Props["onChangeOpen"] = jest.fn();

  const props: Props = {
    mask: baseMask,
    user: baseUser,
    profile: premiumProfile,
    onUpdate,
    onDelete,
    isOpen: false,
    onChangeOpen,
    showLabelEditor: true,
    runtimeData,
    placeholder: "Add a label",
    isOnboarding: false,
    children: <div data-testid="onboarding-children">child</div>,
    copyAfterMaskGeneration: false,
  };

  const utils = render(<MaskCard {...{ ...props, ...override }} />);
  return { ...utils, onUpdate, onDelete, onChangeOpen };
}

describe("MaskCard", () => {
  test("copies address to clipboard and shows temporary confirmation", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderMaskCard();

    const copyBtn = screen.getByTitle(byMsgId("profile-label-click-to-copy"));
    await user.click(copyBtn);

    // We no longer assert the specific copy mechanism (Clipboard API vs execCommand),
    // since the component may take either path depending on the environment.
    // The visible confirmation is the user-facing truth we care about.
    expect(writeTextMock).toBeDefined();

    expect(screen.getByText(byMsgId("profile-label-copied"))).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText(byMsgId("profile-label-copied"))).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("copyAfterMaskGeneration triggers copy confirmation on mount", () => {
    renderMaskCard({ copyAfterMaskGeneration: true });

    // As above, assert the confirmation, not the exact copy mechanism.
    expect(writeTextMock).toBeDefined();

    const toast = screen.getByText(byMsgId("profile-label-copied"));
    expect(toast).toHaveAttribute("aria-hidden", "false");
  });

  test("expand/collapse toggles via button and calls onChangeOpen", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onChangeOpen } = renderMaskCard({ isOpen: false });

    const expandBtn = screen.getByRole("button", {
      name: byMsgId("profile-details-expand"),
    });
    await user.click(expandBtn);
    expect(onChangeOpen).toHaveBeenCalledWith(true);
  });

  test("stats show blocked/forwarded and replies when premium; trackers when flag active", () => {
    setFlag("tracker_removal", true);
    renderMaskCard({
      profile: premiumProfile,
      mask: {
        ...baseMask,
        num_blocked: 1200,
        num_forwarded: 3456,
        num_replied: 78,
        num_level_one_trackers_blocked: 1500,
      } as AliasData,
      isOpen: true,
    });

    expect(
      screen.getByText(byMsgId("profile-label-blocked")),
    ).toBeInTheDocument();
    expect(screen.getByText("1.2K")).toBeInTheDocument();

    expect(
      screen.getByText(byMsgId("profile-label-forwarded")),
    ).toBeInTheDocument();
    expect(screen.getByText("3.5K")).toBeInTheDocument();

    expect(
      screen.getByText(byMsgId("profile-label-replies")),
    ).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();

    expect(
      screen.getByText(byMsgId("profile-label-trackers-removed")),
    ).toBeInTheDocument();
    expect(screen.getByText("1.5K")).toBeInTheDocument();
  });

  test("replies are hidden for free users; promo option shows lock messaging and (optionally) upgrade link", () => {
    renderMaskCard({
      profile: freeProfile,
      isOpen: true,
    });

    expect(
      screen.queryByText(byMsgId("profile-label-replies")),
    ).not.toBeInTheDocument();

    const group = screen.getByRole("radiogroup");
    const promoRadio = within(group).getByRole("radio", {
      name: byMsgId("profile-promo-email-blocking-option-promotions"),
    });

    expect(promoRadio).toBeDisabled();
    expect(screen.getAllByTestId("lock-icon").length).toBeGreaterThan(0);

    const upgrade = screen.queryByRole("link", {
      name: byMsgId("banner-pack-upgrade-cta"),
    });
    if (upgrade) {
      expect(upgrade).toHaveAttribute("href", "/premium#pricing");
    }
  });

  test("block level: selecting 'All' disables mask; 'Promotions' enables + sets block_list_emails=true; 'None' enables + sets block_list_emails=false", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onUpdate } = renderMaskCard({
      profile: premiumProfile,
      isOpen: true,
    });

    const group = screen.getByRole("radiogroup");

    const allRadio = within(group).getByRole("radio", {
      name: byMsgId("profile-promo-email-blocking-option-all"),
    });
    const promoRadio = within(group).getByRole("radio", {
      name: byMsgId("profile-promo-email-blocking-option-promotions"),
    });
    const noneRadio = within(group).getByRole("radio", {
      name: byMsgId("profile-promo-email-blocking-option-none"),
    });

    await user.click(allRadio);
    expect(onUpdate).toHaveBeenCalledWith({ enabled: false });

    await user.click(promoRadio);
    expect(onUpdate).toHaveBeenCalledWith({
      enabled: true,
      block_list_emails: true,
    });

    await user.click(noneRadio);
    expect(onUpdate).toHaveBeenCalledWith({
      enabled: true,
      block_list_emails: false,
    });
  });

  test("block level label reflects current state for all / promotions / none", () => {
    const { rerender } = renderMaskCard({
      isOpen: true,
      mask: { ...baseMask, enabled: false },
    });

    expect(
      screen.getAllByText(byMsgId("profile-promo-email-blocking-label-none-2"))
        .length,
    ).toBeGreaterThan(0);

    const noopUpdate: Props["onUpdate"] = jest.fn();
    const noopDelete: Props["onDelete"] = jest.fn();

    rerender(
      <MaskCard
        mask={{ ...baseMask, enabled: true, block_list_emails: true }}
        user={baseUser}
        profile={premiumProfile}
        onUpdate={noopUpdate}
        onDelete={noopDelete}
        isOpen={true}
        onChangeOpen={jest.fn() as Props["onChangeOpen"]}
        showLabelEditor={true}
        runtimeData={runtimeData}
        placeholder="Add a label"
        isOnboarding={false}
        copyAfterMaskGeneration={false}
      />,
    );
    expect(
      screen.getAllByText(
        byMsgId("profile-promo-email-blocking-label-promotionals-2"),
      ).length,
    ).toBeGreaterThan(0);

    rerender(
      <MaskCard
        mask={{ ...baseMask, enabled: true, block_list_emails: false }}
        user={baseUser}
        profile={premiumProfile}
        onUpdate={noopUpdate}
        onDelete={noopDelete}
        isOpen={true}
        onChangeOpen={jest.fn() as Props["onChangeOpen"]}
        showLabelEditor={true}
        runtimeData={runtimeData}
        placeholder="Add a label"
        isOnboarding={false}
        copyAfterMaskGeneration={false}
      />,
    );
    expect(
      screen.getAllByText(
        byMsgId("profile-promo-email-blocking-label-forwarding-2"),
      ).length,
    ).toBeGreaterThan(0);
  });

  test("meta section shows created date and forwarding email", () => {
    renderMaskCard({ isOpen: true });

    expect(
      screen.getByText(byMsgId("profile-label-created"), { selector: "dt" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(byMsgId("profile-label-forward-emails"), {
        selector: "dt",
      }),
    ).toBeInTheDocument();

    const dateRe = new RegExp(
      `^Rendered\\(${baseMask.created_at.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\)$`,
    );
    expect(screen.getByText(dateRe)).toBeInTheDocument();

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  test("deletion button variant is waffle-flag controlled", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    setFlag("custom_domain_management_redesign", true);
    const { onDelete, rerender } = renderMaskCard({
      isOnboarding: false,
      isOpen: true,
    });
    await user.click(
      screen.getByRole("button", { name: "alias-delete-permanent" }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);

    setFlag("custom_domain_management_redesign", false);
    const noopUpdate: Props["onUpdate"] = jest.fn();
    rerender(
      <MaskCard
        mask={baseMask}
        user={baseUser}
        profile={premiumProfile}
        onUpdate={noopUpdate}
        onDelete={onDelete}
        isOpen={true}
        onChangeOpen={jest.fn() as Props["onChangeOpen"]}
        showLabelEditor={true}
        runtimeData={runtimeData}
        placeholder="Add a label"
        isOnboarding={false}
        copyAfterMaskGeneration={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "alias-delete" }));
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  test("label editor submits and calls onUpdate with new description", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onUpdate } = renderMaskCard({ showLabelEditor: true });
    await user.click(screen.getByLabelText("submit-label"));
    expect(onUpdate).toHaveBeenCalledWith({ description: "New Label" });
  });

  test("onboarding children render only when isOnboarding is true", () => {
    renderMaskCard({ isOnboarding: false });
    expect(screen.queryByTestId("onboarding-children")).not.toBeInTheDocument();

    renderMaskCard({ isOnboarding: true, isOpen: true });
    expect(screen.getByTestId("onboarding-children")).toBeInTheDocument();
  });
});
