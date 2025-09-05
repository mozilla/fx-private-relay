import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MaskCard, Props } from "./MaskCard";
import { AliasData } from "../../../hooks/api/aliases";
import { UserData } from "../../../hooks/api/user";
import { ProfileData } from "../../../hooks/api/profile";
import { RuntimeData } from "../../../hooks/api/types";

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

jest.mock(
  "./MaskCard.module.scss",
  () => new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
);

jest.mock("next/link", () => {
  const MockLink = ({
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
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

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

type IsFlagActiveFn = (
  runtimeData: RuntimeData | undefined,
  name: string,
) => boolean;

const isFlagActiveMock: jest.MockedFunction<IsFlagActiveFn> = jest.fn();

jest.mock("../../../functions/waffle", () => ({
  isFlagActive: (runtimeData: RuntimeData | undefined, name: string) =>
    isFlagActiveMock(runtimeData, name),
}));

jest.mock("../../../hooks/api/aliases", () => ({
  isBlockingLevelOneTrackers: () => false,
}));

jest.mock("./images/calendar.svg", () => "calendar.svg");
jest.mock("./images/email.svg", () => "email.svg");
jest.mock(
  "./../images/free-onboarding-horizontal-arrow.svg",
  () => "arrow.svg",
);

jest.mock("../../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string, _vars?: Record<string, unknown>) => id,
    getAttributes: (_id: string) => ({}),
    getNumberFormatter: () => (n: number) => String(n),
  }),
}));

const matchText = (...variants: string[]) =>
  new RegExp(
    `^(?:${variants.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`,
    "i",
  );

jest.useFakeTimers();

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
  test("copies address to clipboard and shows temporary confirmation", () => {
    renderMaskCard();
    const copyBtn = screen.getByTitle(
      matchText("Click to copy", "profile-label-click-to-copy"),
    );
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "sample@relay.mozilla.com",
    );
    expect(
      screen.getByText(matchText("Copied!", "profile-label-copied")),
    ).toHaveAttribute("aria-hidden", "false");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText(matchText("Copied!", "profile-label-copied")),
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("copyAfterMaskGeneration triggers copy on mount", () => {
    renderMaskCard({ copyAfterMaskGeneration: true });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "sample@relay.mozilla.com",
    );
  });

  test("expand/collapse toggles via button and calls onChangeOpen", () => {
    const { onChangeOpen } = renderMaskCard({ isOpen: false });
    const expandBtn = screen.getByRole("button", {
      name: /expand|profile-details-expand/i,
    });
    fireEvent.click(expandBtn);
    expect(onChangeOpen).toHaveBeenCalledWith(true);
  });

  test("stats show blocked/forwarded and replies when premium; trackers when flag active", () => {
    isFlagActiveMock.mockImplementation(
      (_rd, name) => name === "tracker_removal",
    );
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
      screen.getByText(matchText("Blocked", "profile-label-blocked")),
    ).toBeInTheDocument();
    expect(screen.getByText("1.2K")).toBeInTheDocument();
    expect(
      screen.getByText(matchText("Forwarded", "profile-label-forwarded")),
    ).toBeInTheDocument();
    expect(screen.getByText("3.5K")).toBeInTheDocument();
    expect(
      screen.getByText(matchText("Replies", "profile-label-replies")),
    ).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(
      screen.getByText(
        matchText("Trackers removed", "profile-label-trackers-removed"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("1.5K")).toBeInTheDocument();
  });

  test("replies are hidden for free users; promo option shows lock messaging and upgrade link", () => {
    isFlagActiveMock.mockReturnValue(false);
    renderMaskCard({
      profile: freeProfile,
      isOpen: true,
    });
    expect(
      screen.queryByText(matchText("Replies", "profile-label-replies")),
    ).not.toBeInTheDocument();
    const promoOption = screen.getByText(
      matchText("Promotions", "profile-promo-email-blocking-option-promotions"),
    );
    fireEvent.click(promoOption);
    expect(
      screen.getAllByText(
        matchText(
          "Promotionals (Premium)",
          "profile-promo-email-blocking-description-promotionals-locked-label",
        ),
      )[0],
    ).toBeInTheDocument();
    const locks = screen.getAllByTestId("lock-icon");
    expect(locks.length).toBeGreaterThan(0);
    const upgrade = screen.getByRole("link", {
      name: matchText("Upgrade", "banner-pack-upgrade-cta"),
    });
    expect(upgrade).toHaveAttribute("href", "/premium#pricing");
  });

  test("block level: selecting 'All' disables mask; 'Promotions' enables + sets block_list_emails=true; 'None' enables + sets block_list_emails=false", () => {
    const { onUpdate } = renderMaskCard({
      profile: premiumProfile,
      isOpen: true,
    });
    fireEvent.click(
      screen.getByText(
        matchText("All", "profile-promo-email-blocking-option-all"),
      ),
    );
    expect(onUpdate).toHaveBeenCalledWith({ enabled: false });
    fireEvent.click(
      screen.getByText(
        matchText(
          "Promotions",
          "profile-promo-email-blocking-option-promotions",
        ),
      ),
    );
    expect(onUpdate).toHaveBeenCalledWith({
      enabled: true,
      block_list_emails: true,
    });
    fireEvent.click(
      screen.getByText(
        matchText("None", "profile-promo-email-blocking-option-none"),
      ),
    );
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
      screen.getByText(
        matchText("Blocking all", "profile-promo-email-blocking-label-none-2"),
      ),
    ).toBeInTheDocument();
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
      screen.getByText(
        matchText(
          "Blocking promotionals",
          "profile-promo-email-blocking-label-promotionals-2",
        ),
      ),
    ).toBeInTheDocument();
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
      screen.getByText(
        matchText(
          "Forwarding all",
          "profile-promo-email-blocking-label-forwarding-2",
        ),
      ),
    ).toBeInTheDocument();
  });

  test("meta section shows created date and forwarding email", () => {
    renderMaskCard({ isOpen: true });
    expect(
      screen.getByText(matchText("Created", "profile-label-created")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Rendered\(2024-01-15T10:00:00Z\)$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(matchText("Forward to", "profile-label-forward-emails")),
    ).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  test("deletion button variant is waffle-flag controlled", () => {
    isFlagActiveMock.mockImplementation(
      (_rd, name) => name === "custom_domain_management_redesign",
    );
    const { onDelete, rerender } = renderMaskCard({
      isOnboarding: false,
      isOpen: true,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "alias-delete-permanent" }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    isFlagActiveMock.mockReturnValue(false);
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
    fireEvent.click(screen.getByRole("button", { name: "alias-delete" }));
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  test("label editor submits and calls onUpdate with new description", () => {
    const { onUpdate } = renderMaskCard({ showLabelEditor: true });
    fireEvent.click(screen.getByLabelText("submit-label"));
    expect(onUpdate).toHaveBeenCalledWith({ description: "New Label" });
  });

  test("onboarding children render only when isOnboarding is true", () => {
    renderMaskCard({ isOnboarding: false });
    expect(screen.queryByTestId("onboarding-children")).not.toBeInTheDocument();
    renderMaskCard({ isOnboarding: true, isOpen: true });
    expect(screen.getByTestId("onboarding-children")).toBeInTheDocument();
  });
});
