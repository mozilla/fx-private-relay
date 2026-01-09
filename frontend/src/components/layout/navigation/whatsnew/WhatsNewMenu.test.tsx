import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsNewMenu } from "./WhatsNewMenu";
import { useAddonData } from "../../../../hooks/addon";
import { useLocalDismissal } from "../../../../hooks/localDismissal";
import { isUsingFirefox } from "../../../../functions/userAgent";
import {
  mockedRuntimeData,
  mockedProfiles,
} from "../../../../../__mocks__/api/mockData";

jest.mock("../../../../functions/waffle");
import {
  mockIsFlagActive,
  resetFlags,
} from "frontend/__mocks__/functions/flags";

jest.mock("../../../../hooks/gaEvent");
jest.mock("../../../../hooks/addon");
jest.mock("../../../../hooks/localDismissal");
jest.mock("../../../../functions/userAgent");

const l10nMock = {
  getString: jest.fn((key: string, vars?: unknown) =>
    vars ? `${key}:${JSON.stringify(vars)}` : `${key}`,
  ),
};

const mockedRuntimeDataWithNoBundle = {
  ...mockedRuntimeData,
  BUNDLE_PLANS: {
    ...mockedRuntimeData.BUNDLE_PLANS,
    available_in_country: false,
  },
};

describe("WhatsNewMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFlags();
    mockIsFlagActive.mockReset();
    mockIsFlagActive.mockReturnValue(true);

    // @ts-expect-error set by jest.setup.ts
    global.useL10nImpl = () => l10nMock;
    global.getLocaleMock.mockReturnValue("en");
    global.gaEventMock = jest.fn();

    (useAddonData as unknown as jest.Mock).mockReturnValue({ present: false });
    (isUsingFirefox as unknown as jest.Mock).mockReturnValue(false);

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2022-03-15T12:00:00Z"));
  });

  it("renders trigger when there are visible announcements", () => {
    (useLocalDismissal as unknown as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    render(
      <WhatsNewMenu
        profile={mockedProfiles.empty}
        runtimeData={mockedRuntimeDataWithNoBundle}
        style="test-style"
      />,
    );

    expect(
      screen.getByRole("button", { name: /whatsnew-trigger-label/i }),
    ).toBeInTheDocument();
  });

  it("shows pill when undismissed entries exist", () => {
    (useLocalDismissal as unknown as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    render(
      <WhatsNewMenu
        profile={mockedProfiles.empty}
        runtimeData={mockedRuntimeDataWithNoBundle}
        style="test-style"
      />,
    );

    expect(screen.getByTestId("whatsnew-pill")).toHaveTextContent("1");
  });

  it("opens the overlay and displays the dashboard", async () => {
    (useLocalDismissal as unknown as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <WhatsNewMenu
        profile={mockedProfiles.empty}
        runtimeData={mockedRuntimeDataWithNoBundle}
        style="test-style"
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /whatsnew-trigger-label/i,
    });
    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
