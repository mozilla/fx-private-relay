import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsNewMenu } from "./WhatsNewMenu";
import { useL10n } from "../../../../hooks/l10n";
import { useGaEvent } from "../../../../hooks/gaEvent";
import { useAddonData } from "../../../../hooks/addon";
import { useLocalDismissal } from "../../../../hooks/localDismissal";
import { isUsingFirefox } from "../../../../functions/userAgent";
import {
  mockedRuntimeData,
  mockedProfiles,
} from "../../../../../__mocks__/api/mockData";

jest.mock("../../../../functions/waffle", () =>
  jest.requireActual("frontend/__mocks__/functions/waffle"),
);
import {
  mockIsFlagActive,
  resetFlags,
} from "frontend/__mocks__/functions/flags";

jest.mock("../../../../hooks/l10n");
jest.mock("../../../../hooks/gaEvent");
jest.mock("../../../../hooks/addon");
jest.mock("../../../../hooks/localDismissal");
jest.mock("../../../../functions/userAgent");
jest.mock("../../../../functions/getLocale", () => ({ getLocale: () => "en" }));

const l10nMock = {
  getString: jest.fn((key, vars) =>
    vars ? `${key}:${JSON.stringify(vars)}` : `${key}`,
  ),
};

const mockedProfileswithMegabundle = {
  ...mockedProfiles.full,
  has_phone: false,
  has_vpn: false,
};

beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    disconnect() {}
    observe() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    unobserve() {}
    constructor() {}
  }
  global.IntersectionObserver =
    MockIntersectionObserver as typeof IntersectionObserver;
});

describe("WhatsNewMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFlags();
    mockIsFlagActive.mockReset();
    mockIsFlagActive.mockReturnValue(true);

    (useL10n as jest.Mock).mockReturnValue(l10nMock);
    (useGaEvent as jest.Mock).mockReturnValue(jest.fn());
    (useAddonData as jest.Mock).mockReturnValue({ present: false });
    (isUsingFirefox as jest.Mock).mockReturnValue(false);

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-06-10T12:00:00Z"));
  });

  it("renders trigger when there are visible announcements", () => {
    (useLocalDismissal as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    render(
      <WhatsNewMenu
        profile={mockedProfileswithMegabundle}
        runtimeData={mockedRuntimeData}
        style="test-style"
      />,
    );

    expect(
      screen.getByRole("button", { name: /whatsnew-trigger-label/i }),
    ).toBeInTheDocument();
  });

  it("shows pill when undismissed entries exist", () => {
    (useLocalDismissal as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    render(
      <WhatsNewMenu
        profile={mockedProfileswithMegabundle}
        runtimeData={mockedRuntimeData}
        style="test-style"
      />,
    );

    expect(screen.getByTestId("whatsnew-pill")).toHaveTextContent("1");
  });

  it("opens the overlay and displays the dashboard", async () => {
    (useLocalDismissal as jest.Mock).mockImplementation(() => ({
      isDismissed: false,
      dismiss: jest.fn(),
    }));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <WhatsNewMenu
        profile={mockedProfileswithMegabundle}
        runtimeData={mockedRuntimeData}
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
